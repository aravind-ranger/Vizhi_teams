import { create } from 'zustand';
import { getDocs, collection, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { todayAttendanceQuery } from '../lib/firestoreQueries';
import { formatDayKey, parseFirestoreDate } from '../lib/firestoreDates';
import { format } from 'date-fns';

export interface AttendanceRecord {
  id: string;
  check_in: string | null;
  work_started_at?: string | null;
  scrum_submitted_at?: string | null;

  check_out: string | null;
  scheduled_checkout: string | null;
  status: string;
  early_exit: boolean;
  duration_minutes: number;
  user_id: string;
  is_paused?: boolean;
  pause_start?: string;
  total_break_ms?: number;
  is_overtime?: boolean;
  overtime_start?: string;
  overtime_duration_minutes?: number;
}

interface AttendanceStore {
  attendance: AttendanceRecord | null;
  isBlocked: boolean;
  isLoading: boolean;
  lateRequestStatus: "pending" | "approved" | "rejected" | null;
  setAttendance: (attendance: AttendanceRecord | null) => void;
  setIsBlocked: (isBlocked: boolean) => void;
  fetchTodayAttendance: (userId: string) => Promise<void>;
}

let activeFetch: Promise<void> | null = null;
let lastFetchKey: string | null = null;
let lastFetchResolved = false;

const fetchLateRequestStatus = async (userId: string) => {
  if (!userId) {
    return null;
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const snap = await getDocs(
    query(
      collection(db, "late_checkin_requests"),
      where("user_id", "==", userId),
      where("request_date", "==", today),
      limit(10),
    ),
  );

  if (snap.empty) {
    return null;
  }

  const latestRequest = snap.docs
    .map((doc) => doc.data() as any)
    .sort((a, b) => {
      const aDate = parseFirestoreDate(a.created_at)?.getTime() || 0;
      const bDate = parseFirestoreDate(b.created_at)?.getTime() || 0;
      return bDate - aDate;
    })[0];

  return latestRequest?.status || null;
};

export const useAttendanceStore = create<AttendanceStore>((set) => ({
  attendance: null,
  isBlocked: false,
  isLoading: true,
  lateRequestStatus: null,
  setAttendance: (attendance) => set({ attendance }),
  setIsBlocked: (isBlocked) => set({ isBlocked }),
  fetchTodayAttendance: async (userId: string) => {
    if (!userId) {
      set({ lateRequestStatus: null, isLoading: false });
      return;
    }

    try {
      const lateRequestStatus = await fetchLateRequestStatus(userId);
      set({ lateRequestStatus });
    } catch (err) {
      console.error("Failed to fetch today's late request status", err);
      set({ lateRequestStatus: null });
    }

    const fetchKey = `${userId}_${formatDayKey()}`;
    if (activeFetch && lastFetchKey === fetchKey) {
      return activeFetch;
    }
    const current = useAttendanceStore.getState().attendance as any;
    const currentCreatedAt = parseFirestoreDate(current?.created_at);
    if (
      lastFetchKey === fetchKey &&
      (lastFetchResolved ||
        (current?.user_id === userId &&
          currentCreatedAt &&
          formatDayKey(currentCreatedAt) === formatDayKey()))
    ) {
      set({ isLoading: false });
      return;
    }

    lastFetchKey = fetchKey;
    activeFetch = (async () => {
    try {
      const snap = await getDocs(todayAttendanceQuery(userId));
      
      if (!snap.empty) {
        const records = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            created_at: parseFirestoreDate(data.created_at)
          } as any as AttendanceRecord;
        });

        if (records[0]) {
          set({ 
            attendance: records[0], 
            isBlocked: records[0].early_exit || false,
            isLoading: false 
          });
          return;
        }
      }

      // If no records found or none from today/open
      set({ attendance: null, isBlocked: false, isLoading: false });
      lastFetchResolved = true;
    } catch (err) {
      console.error('Failed to fetch attendance', err);
      set({ isLoading: false });
    } finally {
      lastFetchResolved = true;
      activeFetch = null;
    }
    })();
    return activeFetch;
  },
}));
