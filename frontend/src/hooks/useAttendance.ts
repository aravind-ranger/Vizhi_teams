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
        total_break_ms: 0,
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
    if (!attendance?.id || !user?.id) return;
    try {
      const now = new Date();
      const checkInTime = new Date(attendance.check_in!);
      
      // Stop all active tasks
      const tasksRef = collection(db, 'tasks');
      const qTasks = query(tasksRef, where('active_session_id', '==', 'active'), where('assigned_to', '==', user.id));
      const activeTasks = await getDocs(qTasks);
      
      for (const taskDoc of activeTasks.docs) {
        const taskData = taskDoc.data();
        const startTime = new Date(taskData.active_session_start.toDate ? taskData.active_session_start.toDate() : taskData.active_session_start).getTime();
        const durationMinutes = Math.floor((now.getTime() - startTime) / 60000);

        await addDoc(collection(db, 'task_sessions'), {
          task_id: taskDoc.id,
          user_id: user.id,
          start_time: taskData.active_session_start,
          end_time: serverTimestamp(),
          duration_minutes: durationMinutes,
          type: 'checkout_auto_pause'
        });

        await updateDoc(doc(db, 'tasks', taskDoc.id), {
          active_session_id: null,
          active_session_start: null,
          is_paused_by_checkout: true, // Specific flag for checkout
          total_minutes_logged: (taskData.total_minutes_logged || 0) + durationMinutes
        });
      }

      // Calculate active duration (Total time - Break time)
      const totalDurationMs = now.getTime() - checkInTime.getTime();
      const breakMs = attendance.total_break_ms || 0;
      const workMs = Math.max(0, totalDurationMs - breakMs);
      const workMinutes = Math.floor(workMs / 60000);
      
      const scheduledCheckout = new Date(attendance.scheduled_checkout!);
      // Allow 15 minutes grace period
      const isEarly = !attendance.is_overtime && (scheduledCheckout.getTime() - now.getTime()) > (15 * 60 * 1000);

      const updateData = {
        check_out: now.toISOString(),
        duration_minutes: workMinutes,
        early_exit: isEarly,
        status: 'completed',
        is_overtime: false,
        is_paused: false,
        pause_start: null
      };

      await updateDoc(doc(db, 'attendance', attendance.id), updateData);
      
      const updatedAttendance = { ...attendance, ...updateData };
      setAttendance(updatedAttendance);
      
      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'Work Ended',
        message: `${user.name} checked out. Worked ${Math.floor(workMinutes/60)}h ${workMinutes%60}m.`,
        type: 'status_change',
        is_read: false,
        created_at: now
      });

      // Add to audit logs
      await addDoc(collection(db, 'audit_logs'), {
        user_id: user.id,
        user_name: user.name,
        action: 'checkout',
        details: `${user.name} checked out. Total: ${workMinutes} min (including OT if any)`,
        duration_minutes: workMinutes,
        shift_minutes: Math.min(480, workMinutes),
        overtime_minutes: Math.max(0, workMinutes - 480),
        created_at: now
      });

      if (isEarly) {
        toast.error(`⚠️ Early exit — ${(workMinutes / 60).toFixed(1)}h worked. Admin notified.`);
        setIsBlocked(true);
      } else {
        toast.success(`👏 Great work! ${(workMinutes / 60).toFixed(1)}h logged today.`);
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
      const breakMs = now.getTime() - pauseStart.getTime();
      const breakMinutes = Math.floor(breakMs / 60000);
      const newTotalBreakMs = (attendance.total_break_ms || 0) + breakMs;

      await updateDoc(doc(db, 'attendance', attendance.id), {
        is_paused: false,
        pause_start: null,
        total_break_ms: newTotalBreakMs
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

      setAttendance({ 
        ...attendance, 
        is_paused: false, 
        pause_start: null,
        total_break_ms: newTotalBreakMs 
      });

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

  const startOvertime = async () => {
    if (!user?.id || !attendance?.id) return;
    try {
      const now = new Date();
      const updateData: any = {
        is_overtime: true,
        overtime_start: now.toISOString(),
        check_out: null, // Allow re-entry if they already checked out
        status: 'overtime'
      };

      await updateDoc(doc(db, 'attendance', attendance.id), updateData);

      // Resume tasks paused by checkout
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('is_paused_by_checkout', '==', true), where('assigned_to', '==', user.id));
      const pausedTasks = await getDocs(q);

      for (const taskDoc of pausedTasks.docs) {
        await updateDoc(doc(db, 'tasks', taskDoc.id), {
          active_session_id: 'active',
          active_session_start: serverTimestamp(),
          is_paused_by_checkout: false
        });
      }

      setAttendance({ ...attendance, ...updateData });

      // Notifications
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'Overtime Started',
        message: `${user.name} has started overtime work`,
        type: 'overtime',
        is_read: false,
        created_at: now
      });

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        user_id: user.id,
        user_name: user.name,
        action: 'overtime_start',
        details: `${user.name} started overtime`,
        created_at: now
      });

      toast.success('Overtime session started! 🚀');
    } catch (err) {
      console.error(err);
      toast.error('Failed to start overtime');
    }
  };

  const refresh = () => {
    if (user?.id) fetchTodayAttendance(user.id);
  };

  return { 
    attendance, 
    isBlocked, 
    isLoading, 
    checkIn, 
    checkOut, 
    pause, 
    resume, 
    startOvertime, 
    refresh 
  };
};
