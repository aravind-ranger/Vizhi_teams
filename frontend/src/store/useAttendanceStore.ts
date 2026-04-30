import { create } from 'zustand';
import { db } from '../firebase.ts';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

export interface AttendanceRecord {
  id: string;
  check_in: string | null;
  check_out: string | null;
  scheduled_checkout: string | null;
  status: string;
  early_exit: boolean;
  duration_minutes: number;
  user_id: string;
  is_paused?: boolean;
  pause_start?: string;
  total_break_ms?: number;
}

interface AttendanceStore {
  attendance: AttendanceRecord | null;
  isBlocked: boolean;
  isLoading: boolean;
  setAttendance: (attendance: AttendanceRecord | null) => void;
  setIsBlocked: (isBlocked: boolean) => void;
  fetchTodayAttendance: (userId: string) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceStore>((set) => ({
  attendance: null,
  isBlocked: false,
  isLoading: true,
  setAttendance: (attendance) => set({ attendance }),
  setIsBlocked: (isBlocked) => set({ isBlocked }),
  fetchTodayAttendance: async (userId: string) => {
    if (!userId) {
      set({ isLoading: false });
      return;
    }
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Fetch all records for this user and sort client-side to avoid complex index requirements
      const q = query(
        collection(db, 'attendance'),
        where('user_id', '==', userId)
      );

      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Find if any record was created today
        const records = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at)
          } as any as AttendanceRecord;
        }).sort((a: any, b: any) => b.created_at.getTime() - a.created_at.getTime());
        
        // Priority 1: Today's record (even if completed)
        const todayRecord = records.find(r => {
          const createdAt = (r as any).created_at;
          return createdAt.getTime() >= startOfToday;
        });

        if (todayRecord) {
          set({ 
            attendance: todayRecord, 
            isBlocked: todayRecord.early_exit || false,
            isLoading: false 
          });
          return;
        }

        // Priority 2: An open session from a previous day (handle it as active)
        const openRecord = records.find(r => !r.check_out);
        if (openRecord) {
          set({ 
            attendance: openRecord, 
            isBlocked: openRecord.early_exit || false,
            isLoading: false 
          });
          return;
        }
      }

      // If no records found or none from today/open
      set({ attendance: null, isBlocked: false, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch attendance', err);
      set({ isLoading: false });
    }
  },
}));
