import { create } from 'zustand';
import { db } from '../firebase.ts';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // First, try to find an open session (no check-out) from any time
      const openQ = query(
        collection(db, 'attendance'),
        where('user_id', '==', userId),
        where('check_out', '==', null),
        limit(1)
      );

      const openSnap = await getDocs(openQ);
      
      if (!openSnap.empty) {
        const doc = openSnap.docs[0];
        const data = doc.data();
        set({ 
          attendance: { id: doc.id, ...data } as AttendanceRecord, 
          isBlocked: data.early_exit || false,
          isLoading: false 
        });
        return;
      }

      // If no open session, look for a completed session from today
      const todayQ = query(
        collection(db, 'attendance'),
        where('user_id', '==', userId),
        where('created_at', '>=', today),
        limit(1)
      );

      const todaySnap = await getDocs(todayQ);
      
      if (!todaySnap.empty) {
        const doc = todaySnap.docs[0];
        const data = doc.data();
        set({ 
          attendance: { id: doc.id, ...data } as AttendanceRecord, 
          isBlocked: data.early_exit || false,
          isLoading: false 
        });
      } else {
        set({ attendance: null, isBlocked: false, isLoading: false });
      }
    } catch (err) {
      console.error('Failed to fetch attendance', err);
      set({ isLoading: false });
    }
  },
}));
