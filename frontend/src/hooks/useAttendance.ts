import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { db } from '../firebase.ts';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useAttendanceStore } from '../store/useAttendanceStore';
import { useAuthStore } from '../store/useAuthStore';

export const useAttendance = () => {
  const { user } = useAuthStore();
  const { attendance, isBlocked, isLoading, setAttendance, setIsBlocked, fetchTodayAttendance } = useAttendanceStore();

  useEffect(() => {
    if (user?.id) {
      fetchTodayAttendance(user.id);
    }
  }, [fetchTodayAttendance, user?.id]);

  const checkIn = async (workLocation?: string) => {
    if (!user?.id) return;
    try {
      const now = new Date();
      // Scheduled checkout is 8 hours from now
      const scheduledCheckout = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      
      const newAttendance = {
        user_id: user.id,
        check_in: now.toISOString(),
        check_out: null,
        scheduled_checkout: scheduledCheckout.toISOString(),
        status: 'present',
        early_exit: false,
        duration_minutes: 0,
        work_location: workLocation || 'office',
        created_at: now
      };

      const docRef = await addDoc(collection(db, 'attendance'), newAttendance);
      
      setAttendance({ id: docRef.id, ...newAttendance });
      
      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'Team Update',
        message: `${user.name} checked in at ${now.toLocaleTimeString()}`,
        type: 'status_change',
        is_read: false,
        created_at: now
      });

      // Add to audit logs
      await addDoc(collection(db, 'audit_logs'), {
        user_id: user.id,
        user_name: user.name,
        action: 'checkin',
        details: `${user.name} checked in from ${workLocation || 'office'}`,
        created_at: now
      });

      toast.success(`Checked in at ${now.toLocaleTimeString()}. Checkout at ${scheduledCheckout.toLocaleTimeString()} 🕐`);
    } catch (err: any) {
      console.error(err);
      toast.error('Check-in failed');
    }
  };

  const checkOut = async () => {
    if (!attendance?.id) return;
    try {
      const now = new Date();
      const checkInTime = new Date(attendance.check_in!);
      const durationMs = now.getTime() - checkInTime.getTime();
      const durationMinutes = Math.floor(durationMs / 60000);
      
      const scheduledCheckout = new Date(attendance.scheduled_checkout!);
      // Allow 15 minutes grace period
      const isEarly = (scheduledCheckout.getTime() - now.getTime()) > (15 * 60 * 1000);

      const updateData = {
        check_out: now.toISOString(),
        duration_minutes: durationMinutes,
        early_exit: isEarly
      };

      await updateDoc(doc(db, 'attendance', attendance.id), updateData);
      
      const updatedAttendance = { ...attendance, ...updateData };
      setAttendance(updatedAttendance);
      
      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'Team Update',
        message: `${user.name} checked out for the day`,
        type: 'status_change',
        is_read: false,
        created_at: now
      });

      // Add to audit logs
      await addDoc(collection(db, 'audit_logs'), {
        user_id: user.id,
        user_name: user.name,
        action: 'checkout',
        details: `${user.name} checked out. Worked for ${durationMinutes} minutes.`,
        duration_minutes: durationMinutes,
        created_at: now
      });

      if (isEarly) {
        toast.error(`⚠️ Early exit — ${(durationMinutes / 60).toFixed(1)}h worked. Admin notified. Login restricted`);
        setIsBlocked(true);
      } else {
        toast.success(`👏 Great work! ${(durationMinutes / 60).toFixed(1)}h worked today.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Check-out failed');
    }
  };

  const pause = async () => {
    if (!attendance?.id || !user?.id) return;
    try {
      const now = new Date();
      await updateDoc(doc(db, 'attendance', attendance.id), {
        is_paused: true,
        pause_start: now.toISOString()
      });

      // Also pause active tasks
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('active_session_id', '==', 'active'), where('assigned_to', '==', user.id));
      const activeTasks = await getDocs(q);
      
      for (const taskDoc of activeTasks.docs) {
        const taskData = taskDoc.data();
        const startTime = taskData.active_session_start.toDate();
        const durationMinutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);

        await addDoc(collection(db, 'task_sessions'), {
          task_id: taskDoc.id,
          user_id: user.id,
          start_time: taskData.active_session_start,
          end_time: now,
          duration_minutes: durationMinutes,
          type: 'break_auto_pause'
        });

        await updateDoc(doc(db, 'tasks', taskDoc.id), {
          active_session_id: null,
          active_session_start: null,
          is_paused_by_break: true,
          total_minutes_logged: (taskData.total_minutes_logged || 0) + durationMinutes
        });
      }

      // Add to audit logs
      await addDoc(collection(db, 'audit_logs'), {
        user_id: user.id,
        user_name: user.name,
        action: 'pause',
        details: `${user.name} went on break`,
        created_at: now
      });

      // Send admin notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'admin', // Or fetch all admins
        title: 'Break Started',
        message: `${user.name} went on break at ${format(now, 'h:mm a')}`,
        type: 'break',
        is_read: false,
        created_at: now
      });

      setAttendance({ ...attendance, is_paused: true, pause_start: now.toISOString() });

      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'Break Time',
        message: `${user.name} went on a break`,
        type: 'status_change',
        is_read: false,
        created_at: now
      });

      toast.success('Break started. Timers frozen.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to pause');
    }
  };

  const resume = async () => {
    if (!attendance?.id || !user?.id || !attendance.pause_start) return;
    try {
      const now = new Date();
      const pauseStart = new Date(attendance.pause_start);
      const breakMinutes = Math.floor((now.getTime() - pauseStart.getTime()) / 60000);

      await updateDoc(doc(db, 'attendance', attendance.id), {
        is_paused: false,
        pause_start: null
      });

      // Resume auto-paused tasks
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('is_paused_by_break', '==', true), where('assigned_to', '==', user.id));
      const pausedTasks = await getDocs(q);

      for (const taskDoc of pausedTasks.docs) {
        await updateDoc(doc(db, 'tasks', taskDoc.id), {
          active_session_id: 'active',
          active_session_start: now,
          is_paused_by_break: false
        });
      }

      // Add to audit logs
      await addDoc(collection(db, 'audit_logs'), {
        user_id: user.id,
        user_name: user.name,
        action: 'resume',
        details: `${user.name} resumed work after ${breakMinutes} min break`,
        duration_minutes: breakMinutes,
        created_at: now
      });

      // Send admin notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'admin',
        title: 'Work Resumed',
        message: `${user.name} resumed at ${format(now, 'h:mm a')}. Break was ${breakMinutes} minutes`,
        type: 'resume',
        is_read: false,
        created_at: now
      });

      setAttendance({ ...attendance, is_paused: false, pause_start: null });

      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'Work Resumed',
        message: `${user.name} is back from break`,
        type: 'status_change',
        is_read: false,
        created_at: now
      });

      toast.success('Work resumed. Tasks restarted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to resume');
    }
  };

  const refresh = () => {
    if (user?.id) fetchTodayAttendance(user.id);
  };

  return { attendance, isBlocked, isLoading, checkIn, checkOut, pause, resume, refresh };
};
