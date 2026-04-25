import { create } from 'zustand';
import api from '../services/api';

export interface AttendanceRecord {
  id: string;
  check_in: string | null;
  check_out: string | null;
  scheduled_checkout: string | null;
  status: string;
  early_exit: boolean;
  duration_minutes: number;
}

interface AttendanceStore {
  attendance: AttendanceRecord | null;
  isBlocked: boolean;
  isLoading: boolean;
  setAttendance: (attendance: AttendanceRecord | null) => void;
  setIsBlocked: (isBlocked: boolean) => void;
  fetchTodayAttendance: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceStore>((set) => ({
  attendance: null,
  isBlocked: false,
  isLoading: true,
  setAttendance: (attendance) => set({ attendance }),
  setIsBlocked: (isBlocked) => set({ isBlocked }),
  fetchTodayAttendance: async () => {
    try {
      const response = await api.get('/attendance/today');
      set({ 
        attendance: response.data.attendance, 
        isBlocked: response.data.isBlocked,
        isLoading: false 
      });
    } catch (err) {
      console.error('Failed to fetch attendance', err);
      set({ isLoading: false });
    }
  },
}));
