import React, { useState, useEffect } from 'react'; // Dashboard Component
import {
  CheckCircle2, Clock, Briefcase, PlayCircle,
  ArrowRight, Plus, Timer, Lock, AlertTriangle, Zap,
  FileText, MessageSquare, PieChart, TrendingUp,
  Play, Square, Home, MapPin, Building, Activity, UserPlus, Info, Pause, Trash2, Calendar
} from 'lucide-react';
import { format, differenceInSeconds, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { useAttendance } from '../hooks/useAttendance';
import { useTitle } from '../hooks/useTitle';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Avatar from '../components/Avatar';
import { db, auth } from '../firebase.ts';
import { collection, query, where, getDocs, limit, orderBy, doc, updateDoc, serverTimestamp, getCountFromServer, writeBatch, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import UserListModal from '../components/UserListModal';

const Dashboard: React.FC = () => {
  const safeFormat = (dateStr: any, fmt: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (!isValid(d)) return 'N/A';
    return format(d, fmt);
  };
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { attendance, isBlocked, isLoading: isAttLoading, checkIn, checkOut, pause, resume, refresh: refreshAttendance } = useAttendance();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [absentEmployees, setAbsentEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState(user?.availability_status || 'available');
  const [efficiency, setEfficiency] = useState<number>(0);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<any>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [showPresentModal, setShowPresentModal] = useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [presentEmployees, setPresentEmployees] = useState<any[]>([]);
  useTitle('Dashboard');

  useEffect(() => {
    if (user?.availability_status) {
      setCurrentStatus(user.availability_status);
    }
  }, [user?.availability_status]);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Basic Stats & Tasks
    const fetchInitialData = async () => {
      try {
        const tasksRef = collection(db, 'tasks');
        const qTasks = query(tasksRef, where('assigned_to', '==', user.id));
        const tasksSnap = await getDocs(qTasks);
        const tasksData = tasksSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          created_at: doc.data().created_at?.toDate ? doc.data().created_at.toDate() : new Date(doc.data().created_at)
        })).sort((a: any, b: any) => b.created_at - a.created_at).slice(0, 3);
        setTasks(tasksData);

        const qInProgress = query(tasksRef, where('assigned_to', '==', user.id), where('status', '==', 'in_progress'));
        const inProgressSnap = await getCountFromServer(qInProgress);
        
        const qDone = query(tasksRef, where('assigned_to', '==', user.id), where('status', '==', 'done'));
        const doneSnap = await getCountFromServer(qDone);

        setStats(prev => ({
          ...prev,
          total_tasks: tasksSnap.size,
          in_progress: inProgressSnap.data().count,
          completed: doneSnap.data().count
        }));
      } catch (err) {
        console.error("Dashboard initial fetch error:", err);
      }
    };

    fetchInitialData();

    // 2. Real-time Team Presence
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const usersRef = collection(db, 'users');
    const leavesRef = collection(db, 'leaves');
    const attRef = collection(db, 'attendance');

    let allUsers: any[] = [];
    
    const unsubscribeUsers = onSnapshot(query(usersRef, where('is_active', '==', true)), (userSnap) => {
      allUsers = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateTeamStats();
    });

    let onLeaveUserIds = new Set();
    const unsubscribeLeaves = onSnapshot(query(leavesRef, where('status', '==', 'approved')), (leaveSnap) => {
      onLeaveUserIds = new Set();
      leaveSnap.docs.forEach(d => {
        const leave = d.data();
        const from = leave.from_date?.toDate ? leave.from_date.toDate() : new Date(leave.from_date);
        const to = leave.to_date?.toDate ? leave.to_date.toDate() : new Date(leave.to_date);
        if (todayStart >= from && todayStart <= to) {
          onLeaveUserIds.add(leave.user_id);
        }
      });
      updateTeamStats();
    });

    let presentUsers: any[] = [];
    const unsubscribeAtt = onSnapshot(attRef, (attSnap) => {
      const presentIds = new Set();
      const records: any[] = [];
      attSnap.docs.forEach(d => {
        const data = d.data();
        const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
        if (createdAt >= todayStart && createdAt <= todayEnd) {
          presentIds.add(data.user_id);
          records.push({ id: d.id, ...data, createdAt });
        }
      });

      presentUsers = records;
      updateTeamStats();
    });

    const updateTeamStats = () => {
      if (allUsers.length === 0) return;

      const presentIds = new Set(presentUsers.map(r => r.user_id));
      const presentList = allUsers
        .filter(u => presentIds.has(u.id))
        .map(u => {
          const userRecords = presentUsers.filter(r => r.user_id === u.id)
            .sort((a, b) => b.createdAt - a.createdAt);
          return { ...u, check_in: userRecords[0]?.check_in, work_location: userRecords[0]?.work_location };
        });

      const onLeaveList = allUsers.filter(u => onLeaveUserIds.has(u.id));
      const absentList = allUsers.filter(u => 
        !presentIds.has(u.id) && 
        !onLeaveUserIds.has(u.id) && 
        u.role !== 'admin'
      );

      setPresentEmployees(presentList);
      setAbsentEmployees(absentList);
      setStats(prev => ({
        ...prev,
        present_count: presentList.length,
        absent_count: absentList.length,
        on_leave_count: onLeaveList.length
      }));
      setIsLoading(false);
    };

    return () => {
      unsubscribeUsers();
      unsubscribeLeaves();
      unsubscribeAtt();
    };
  }, [user]);

  useEffect(() => {
    // Subscribe to Calendar Events
    const qCal = query(collection(db, 'calendar_events'));
    const unsubscribe = onSnapshot(qCal, (snap) => {
      const nowStr = format(new Date(), 'yyyy-MM-dd');
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Dashboard view (promoted + upcoming)
      const promoted = all
        .filter(e => e.is_promoted_to_dashboard && e.date >= nowStr)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 10);
      setCalendarEvents(promoted);

      // All for picker (Admin)
      if (user?.role === 'admin') {
        setAllEvents(all.sort((a, b) => b.date.localeCompare(a.date)));
      }
    });
    return () => unsubscribe();
  }, [user?.role]);

  const toggleTimer = async (taskId: string, isActive: boolean) => {
    if (!attendance?.check_in || attendance?.check_out) {
      toast.error('You must be checked in to work on tasks ⚠️');
      return;
    }

    if (attendance?.is_paused) {
      toast.error('Please resume work before interacting with task timers');
      return;
    }

    try {
      const taskRef = doc(db, 'tasks', taskId);
      if (isActive) {
        await updateDoc(taskRef, {
          active_session_id: null,
          status: 'todo' // or keep as in_progress
        });
      } else {
        await updateDoc(taskRef, {
          active_session_id: 'active', // simplified for now
          status: 'in_progress'
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    let interval: any;
    if (attendance?.check_in && !attendance?.check_out && !attendance?.is_paused) {
      interval = setInterval(() => {
        const checkInTime = new Date(attendance.check_in!);
        const now = new Date();
        const breakSeconds = (attendance.total_break_ms || 0) / 1000;
        const diff = 8 * 3600 - (differenceInSeconds(now, checkInTime) - breakSeconds);
        setTimeLeft(diff);
      }, 1000);
      return () => clearInterval(interval);
    } else if (attendance?.is_paused && attendance.pause_start) {
      const checkInTime = new Date(attendance.check_in!);
      const pauseTime = new Date(attendance.pause_start);
      const breakSeconds = (attendance.total_break_ms || 0) / 1000;
      const diff = 8 * 3600 - (differenceInSeconds(pauseTime, checkInTime) - breakSeconds);
      setTimeLeft(diff);
    } else if (!attendance?.check_in) {
      setTimeLeft(null);
    }
  }, [attendance]);

  const formatTimeLeft = (seconds: number) => {
    const isOvertime = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const h = Math.floor(absSeconds / 3600);
    const m = Math.floor((absSeconds % 3600) / 60);
    const s = Math.floor(absSeconds % 60);
    
    const pad = (n: number) => String(n).padStart(2, '0');
    
    return {
      text: `${pad(h)}:${pad(m)}:${pad(s)}`,
      isOvertime
    };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const statCards = [
    { label: 'Total Tasks', value: stats?.total_tasks || 0, icon: Briefcase, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'In Progress', value: stats?.in_progress || 0, icon: PlayCircle, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Present Today', value: stats?.present_count || 0, icon: UserPlus, color: 'text-success', bg: 'bg-success/10', action: () => setShowPresentModal(true) },
    { label: 'Absent', value: stats?.absent_count || 0, icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10', action: () => setShowAbsentModal(true) },
  ];

  return (
    <div className="space-y-10 animate-slide-up max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-text-primary tracking-tight">
            {getGreeting()}, <span className="text-primary">{user?.name.split(' ')[0]}</span> 👋
          </h2>
          <p className="text-text-muted mt-2 font-medium">Ready for another productive day at Vizhi?</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="glass px-2 py-1.5 rounded-2xl flex items-center space-x-1 border-none shadow-sm">
            {[
              { id: 'available', label: 'Available', color: 'bg-success', icon: Activity },
              { id: 'busy', label: 'Busy', color: 'bg-danger', icon: Lock },
              { id: 'away', label: 'Away', color: 'bg-warning', icon: Clock },
              { id: 'permission', label: 'Permission', color: 'bg-primary', icon: UserPlus },
            ].map((s) => (
              <button
                key={s.id}
                onClick={async () => {
                  try {
                    const userRef = doc(db, 'users', user!.id);
                    await updateDoc(userRef, { availability_status: s.id });
                    setCurrentStatus(s.id);

                    // Broadcast notification to all other users
                    const usersSnap = await getDocs(collection(db, 'users'));
                    const batch = writeBatch(db);
                    usersSnap.docs.forEach(u => {
                      if (u.id !== user!.id) {
                        const notifRef = doc(collection(db, 'notifications'));
                        batch.set(notifRef, {
                          user_id: u.id,
                          title: `Status: ${user!.name} is ${s.label}`,
                          message: `${user!.name} has changed their status to ${s.label}`,
                          type: 'status_change',
                          is_read: false,
                          created_at: serverTimestamp()
                        });
                      }
                    });
                    await batch.commit();

                    toast.success(`Status updated to ${s.label}`);
                  } catch (err) {
                    toast.error('Failed to update status');
                  }
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${currentStatus === s.id ? 'bg-white shadow-md' : 'opacity-40 hover:opacity-100'}`}
              >
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            onClick={stat.action}
            className={`glass p-8 rounded-[32px] flex items-center space-x-6 border-none shadow-sm hover:shadow-xl transition-all group ${stat.action ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
          >
            <div className={`p-4 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-black text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-text-primary">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Absence Tracker */}
      {user?.role === 'admin' && absentEmployees.length > 0 && (
        <div className="glass p-8 rounded-[40px] border-none shadow-sm bg-rose-50/50 dark:bg-rose-900/10 border-rose-100/50 dark:border-rose-900/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-xl font-black text-rose-900 dark:text-rose-100">Absent Today</h3>
            </div>
            <span className="text-[10px] font-black bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-xl uppercase tracking-widest">
              {absentEmployees.length} EMPLOYEES
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {absentEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center space-x-3 bg-white dark:bg-white/5 p-3 rounded-2xl shadow-sm border border-rose-100/50 dark:border-rose-900/20">
                <Avatar name={emp.name} size="xs" />
                <div>
                  <p className="text-xs font-bold text-text-primary">{emp.name}</p>
                  <p className="text-[9px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-tighter">No Check-in</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Attendance & Tasks */}
        <div className="xl:col-span-2 space-y-8">
          <div className="glass p-10 rounded-[40px] border-none shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5">
              <Clock className="w-32 h-32 rotate-12" />
            </div>

            <div className="flex justify-between items-center mb-10 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-text-primary">Attendance Pulse</h3>
                <p className="text-sm text-text-muted font-medium">Synchronized with local server time</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-primary tracking-tighter">{format(new Date(), 'HH:mm')}</p>
                <p className="text-[10px] text-text-muted uppercase font-black tracking-[0.3em]">{format(new Date(), 'EEEE, MMMM d')}</p>
              </div>
            </div>

            <div className="relative z-10">
              {isAttLoading ? (
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-[32px] p-16 text-center border border-white/20 dark:border-white/10">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm font-bold text-text-muted uppercase tracking-widest">Restoring session...</p>
                </div>
              ) : !attendance?.check_in ? (
                <div className="bg-white/5 dark:bg-white/5 backdrop-blur-sm rounded-[32px] p-16 text-center border border-white/20">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Zap className="w-10 h-10 text-primary fill-current" />
                  </div>
                  <h4 className="text-2xl font-black mb-3">Time to get started?</h4>
                  <p className="text-text-muted mb-10 max-w-sm mx-auto font-medium">Ready to tackle your tasks? Check in to begin your 8-hour shift.</p>
                  <div className="flex items-center justify-center space-x-3 text-primary animate-pulse">
                    <Clock className="w-5 h-5" />
                    <p className="text-sm font-black uppercase tracking-widest">Waiting for check-in via top bar</p>
                  </div>
                </div>
              ) : attendance.check_out ? (
                <div className="bg-success/5 dark:bg-success/10 border border-success/20 dark:border-success/30 rounded-[32px] p-12 text-center">
                  <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-6" />
                  <h4 className="text-3xl font-black text-success mb-2">Shift Completed!</h4>
                  <p className="text-text-secondary font-bold mb-8">You've done a great job today. See you tomorrow!</p>
                  <div className="flex justify-center space-x-12">
                    <div>
                      <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-1">Total Time</p>
                      <p className="text-3xl font-black">{(attendance.duration_minutes / 60).toFixed(1)}h</p>
                    </div>
                    <div className="w-px h-12 bg-success/20" />
                    <div>
                      <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-1">Check-out</p>
                      <p className="text-3xl font-black">{safeFormat(attendance.check_out, 'HH:mm')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left">
                      <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-2">Check-in</p>
                      <p className="text-3xl font-black">{safeFormat(attendance.check_in, 'HH:mm a')}</p>
                    </div>
                    <div className={`text-center p-8 rounded-[32px] border min-w-[280px] transition-all ${attendance.is_paused ? 'bg-amber-500/10 border-amber-500/20' : 'bg-primary/5 border-primary/10'}`}>
                      <p className={`text-[10px] uppercase font-black tracking-widest mb-2 ${attendance.is_paused ? 'text-amber-500' : 'text-primary'}`}>
                        {attendance.is_paused ? 'Break Time' : 'Time Remaining'}
                      </p>
                      {timeLeft !== null && (
                        <div className="flex items-center justify-center space-x-3">
                          <p className={`text-5xl font-black tracking-tighter tabular-nums ${attendance.is_paused ? 'text-amber-500' : (timeLeft < 3600 ? 'text-danger' : 'text-text-primary')}`}>
                            {formatTimeLeft(timeLeft).text}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-center md:text-right">
                      <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-2">Target Finish</p>
                      <p className="text-3xl font-black">{safeFormat(attendance.scheduled_checkout, 'HH:mm a')}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                      <span>Shift Progress</span>
                      {timeLeft !== null && timeLeft < 0 && <span className="text-warning animate-pulse">Overtime Mode</span>}
                    </div>
                    <ProgressBar
                      progress={Math.min(100, (1 - (timeLeft || 0) / (8 * 3600)) * 100)}
                      className="h-4 rounded-full"
                    />
                  </div>
                  <div className={`flex items-center space-x-3 ${attendance.is_paused ? 'text-amber-500' : 'text-success animate-pulse'}`}>
                    <div className={`w-2 h-2 rounded-full ${attendance.is_paused ? 'bg-amber-500' : 'bg-success'}`} />
                    <p className="text-xs font-black uppercase tracking-[0.3em]">
                      {attendance.is_paused ? 'Break in progress' : 'Work session in progress'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass p-8 rounded-[32px] border-none shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black">Active Tasks</h3>
                <button
                  onClick={() => navigate('/tasks')}
                  className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <ArrowRight className="w-5 h-5 text-primary" />
                </button>
              </div>
              <div className="space-y-4">
                {isLoading ? [1, 2].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />) :
                  tasks.length === 0 ? <p className="text-sm text-text-muted text-center py-4">No active tasks</p> :
                    tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-4 bg-white/5 dark:bg-white/5 rounded-2xl border border-white/20 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${task.active_session_id ? 'bg-primary animate-ping' : 'bg-gray-300 dark:bg-gray-700'}`} />
                          <span className="text-sm font-bold truncate max-w-[150px]">{task.title}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (attendance?.is_paused) {
                                toast.error('Please resume work before starting/stopping tasks');
                                return;
                              }
                              toggleTimer(task.id, !!task.active_session_id);
                            }}
                            disabled={attendance?.is_paused}
                            className={`p-1.5 rounded-lg transition-all ${attendance?.is_paused ? 'opacity-50 grayscale cursor-not-allowed' : ''} ${task.active_session_id ? 'bg-danger text-white' : 'bg-primary/10 text-primary opacity-0 group-hover:opacity-100'}`}
                          >
                            {task.active_session_id ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                          </button>
                          <PriorityBadge priority={task.priority} />
                        </div>
                      </div>
                    ))}
              </div>
            </div>
            <div className="glass p-8 rounded-[32px] border-none shadow-sm bg-primary text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <TrendingUp className="w-32 h-32" />
              </div>
              <h3 className="text-xl font-black mb-2 relative z-10">Performance</h3>
              <p className="text-white/70 text-sm font-medium mb-8 relative z-10">You're doing better than 85% of your team this week!</p>
              <div className="flex items-end justify-between relative z-10">
                <div className="space-y-1">
                  <p className="text-4xl font-black">{(efficiency / 10).toFixed(1)}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Quality Score</p>
                </div>
                <div className="h-16 w-32 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Team */}
        <div className="space-y-8">
          <div className="glass p-8 rounded-[32px] border-none shadow-sm">
            <h3 className="text-xl font-black mb-8">Quick Launch</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Apply Leave', icon: FileText, color: 'bg-emerald-50 text-emerald-600', path: '/leaves' },
                { label: 'Daily Scrum', icon: MessageSquare, color: 'bg-amber-50 text-amber-600', path: '/daily-scrum' },
                { label: 'View Reports', icon: PieChart, color: 'bg-indigo-50 text-indigo-600', path: '/reports' },
                { label: 'New Task', icon: Plus, color: 'bg-rose-50 text-rose-600', path: '/tasks' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center justify-center p-6 rounded-[24px] bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 hover:shadow-xl hover:scale-105 transition-all group"
                >
                  <div className={`p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform ${action.color} dark:bg-white/10 dark:text-white group-hover:bg-white dark:group-hover:bg-primary`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass p-8 rounded-[32px] border-none shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black">Upcoming</h3>
              <div className="flex items-center space-x-2">
                {user?.role === 'admin' && (
                  <button 
                    onClick={() => setShowEventPicker(true)}
                    className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                <CalendarIcon className="w-5 h-5 text-text-muted" />
              </div>
            </div>
            <div className="space-y-6">
              {calendarEvents.length > 0 ? (
                calendarEvents.map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedEventDetail(item)}
                    className="flex items-start space-x-4 group cursor-pointer"
                  >
                    <div className={`w-1 h-12 rounded-full flex-shrink-0 transition-all group-hover:w-2 ${
                      item.type === 'holiday' ? 'bg-rose-500' : 
                      item.type === 'meeting' ? 'bg-indigo-500' : 'bg-amber-500'
                    }`} />
                    <div>
                      <p className="text-sm font-black text-text-primary group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mt-1">
                        {safeFormat(item.date, 'MMM d, EEEE')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                  <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">No Upcoming Events</p>
                  <p className="text-[10px] text-gray-400 mt-1">Check back later for updates</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Event Picker Modal (Admin) */}
      {showEventPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEventPicker(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-border w-full max-w-lg rounded-[40px] shadow-2xl animate-scale-up overflow-hidden">
            <div className="p-8 border-b border-gray-100 dark:border-border flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
              <h3 className="text-xl font-black text-text-primary">Select Dashboard Events</h3>
              <button onClick={() => setShowEventPicker(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Select events to display on dashboard</p>
              {allEvents.length === 0 ? (
                <p className="text-center text-text-muted py-10 font-medium">No events created yet.</p>
              ) : (
                allEvents.map((item: any) => (
                  <div 
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      item.is_promoted_to_dashboard ? 'bg-primary/5 border-primary/20' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${
                        item.type === 'holiday' ? 'bg-rose-500' : 
                        item.type === 'meeting' ? 'bg-indigo-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <p className="text-sm font-bold text-text-primary">{item.title}</p>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                          {safeFormat(item.date, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        setIsPromoting(true);
                        try {
                          await updateDoc(doc(db, 'calendar_events', item.id), {
                            is_promoted_to_dashboard: !item.is_promoted_to_dashboard
                          });
                        } catch (err) {
                          toast.error('Failed to update event');
                        } finally {
                          setIsPromoting(false);
                        }
                      }}
                      disabled={isPromoting}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        item.is_promoted_to_dashboard 
                        ? 'bg-success text-white' 
                        : 'bg-white border border-gray-200 text-text-muted hover:border-primary hover:text-primary'
                      }`}
                    >
                      {item.is_promoted_to_dashboard ? 'Selected' : 'Add to Dashboard'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-8 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button 
                onClick={() => setShowEventPicker(false)}
                className="px-10 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEventDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedEventDetail(null)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-border w-full max-w-md rounded-[40px] shadow-2xl animate-scale-up overflow-hidden">
            <div className={`h-3 w-full ${
              selectedEventDetail.type === 'holiday' ? 'bg-rose-500' : 
              selectedEventDetail.type === 'meeting' ? 'bg-indigo-500' : 'bg-amber-500'
            }`} />
            <div className="p-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
                    selectedEventDetail.type === 'holiday' ? 'bg-rose-100 text-rose-600' : 
                    selectedEventDetail.type === 'meeting' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {selectedEventDetail.type}
                  </span>
                  <h3 className="text-2xl font-black text-text-primary mt-4 tracking-tight">{selectedEventDetail.title}</h3>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl text-center min-w-[80px]">
                  <p className="text-xl font-black text-text-primary">
                    {safeFormat(selectedEventDetail.date, 'd')}
                  </p>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    {safeFormat(selectedEventDetail.date, 'MMM')}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Description</p>
                  <p className="text-sm font-medium text-text-secondary leading-relaxed bg-gray-50 dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/10">
                    {selectedEventDetail.description || 'No description provided for this event.'}
                  </p>
                </div>

                <div className="flex flex-col space-y-3 pt-4">
                  {user?.role === 'admin' && (
                    <button 
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to remove this from the dashboard?')) {
                          try {
                            await updateDoc(doc(db, 'calendar_events', selectedEventDetail.id), {
                              is_promoted_to_dashboard: false
                            });
                            toast.success('Removed from dashboard');
                            setSelectedEventDetail(null);
                          } catch (err) {
                            toast.error('Failed to remove event');
                          }
                        }
                      }}
                      className="w-full py-4 bg-danger/10 text-danger text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-danger hover:text-white transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove from Dashboard
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedEventDetail(null)}
                    className="w-full py-4 text-text-muted text-xs font-black uppercase tracking-widest hover:text-text-primary transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User List Modals */}
      <UserListModal
        isOpen={showPresentModal}
        onClose={() => setShowPresentModal(false)}
        title="Present Today"
        users={presentEmployees}
        type="present"
      />
      <UserListModal
        isOpen={showAbsentModal}
        onClose={() => setShowAbsentModal(false)}
        title="Absent Users"
        users={absentEmployees}
        type="absent"
      />
    </div>
  );
};

const X = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const CalendarIcon = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;

export default Dashboard;
