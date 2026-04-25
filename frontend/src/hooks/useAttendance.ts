import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAttendanceStore } from '../store/useAttendanceStore';

export const useAttendance = () => {
  const { attendance, isBlocked, isLoading, setAttendance, setIsBlocked, fetchTodayAttendance } = useAttendanceStore();

  useEffect(() => {
    fetchTodayAttendance();
  }, [fetchTodayAttendance]);

  const checkIn = async (workLocation?: string) => {
    try {
      const response = await api.post('/attendance/checkin', { work_location: workLocation });
      setAttendance(response.data.attendance);
      toast.success(`Checked in at ${new Date(response.data.attendance.check_in).toLocaleTimeString()}. Checkout at ${new Date(response.data.attendance.scheduled_checkout).toLocaleTimeString()} 🕐`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    }
  };

  const checkOut = async () => {
    try {
      const response = await api.post('/attendance/checkout');
      setAttendance(response.data.attendance);
      
      if (response.data.attendance.early_exit) {
        toast.error(`⚠️ Early exit — ${(response.data.attendance.duration_minutes / 60).toFixed(1)}h worked. Admin notified. Login restricted`);
        setIsBlocked(true);
      } else {
        toast.success(`👏 Great work! ${(response.data.attendance.duration_minutes / 60).toFixed(1)}h worked today.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    }
  };

  return { attendance, isBlocked, isLoading, checkIn, checkOut, refresh: fetchTodayAttendance };
};
