import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, Layout, List, MoreVertical, 
  CheckCircle2, Clock, AlertCircle, Calendar, User, X,
  Play, Square, Timer as TimerIcon, MessageSquare, 
  ChevronRight, ArrowRight, Save, Link, Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../firebase.ts';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, where, getDoc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { useTitle } from '../hooks/useTitle';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../store/useAuthStore';
import { useAttendanceStore } from '../store/useAttendanceStore';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'active' | 'completed' | 'planned' | 'pending' | 'paused_by_break';
  priority: 'low' | 'medium' | 'high';
  project_name: string;
  project_id: string;
  assignee_name: string;
  assigned_to: string;
  due_date: string;
  estimated_hours: number;
  total_minutes_logged: number;
  task_code?: string;
  active_session_id: string | null;
  active_session_start?: string;
  is_approved: boolean;
  is_paused_by_break?: boolean;
  rejection_reason?: string;
  created_by?: string;
  is_project_task?: boolean;
}

const LiveTimer: React.FC<{ start: string; baseMinutes: number }> = ({ start, baseMinutes }) => {
  const { attendance } = useAttendanceStore();
  const isPaused = attendance?.is_paused;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isPaused) return;

    const startTime = new Date(start).getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setElapsed(Math.floor((now - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [start, isPaused]);

  const totalSeconds = ((baseMinutes || 0) * 60) + (elapsed || 0);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return (
    <span className="font-mono text-primary tabular-nums">
      {h > 0 && `${h}h `}{m}m {s}s
    </span>
  );
};

const Tasks: React.FC = () => {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  useTitle('Tasks');

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('task_form_backup');
    return saved ? JSON.parse(saved) : {
      title: '',
      description: '',
      project_id: '',
      assigned_to: '',
      priority: 'medium',
      due_date: '',
      estimated_hours: 0
    };
  });

  // Backup form to localStorage
  useEffect(() => {
    localStorage.setItem('task_form_backup', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    fetchMetadata();
    
    // Real-time listener for tasks
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        due_date: doc.data().due_date?.toDate?.()?.toISOString() || doc.data().due_date,
        active_session_start: doc.data().active_session_start?.toDate?.()?.toISOString() || doc.data().active_session_start,
      })) as any;
      
      setTasks(tasksData);
      setIsLoading(false);
      
      // Update selected task if open
      setSelectedTask(prev => {
        if (!prev) return null;
        return tasksData.find(t => t.id === prev.id) || prev;
      });
    }, (err) => {
      console.error('Task listener error:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync tasks with Attendance Breaks
  const { attendance } = useAttendanceStore();
  const isPaused = attendance?.is_paused;

  useEffect(() => {
    const syncBreakWithTasks = async () => {
      // Find tasks that need syncing
      const activeTask = tasks.find(t => t.active_session_id === 'active');
      const autoPausedTask = tasks.find(t => t.is_paused_by_break === true);

      if (isPaused && activeTask) {
        // Automatically pause the active task when break starts
        const taskRef = doc(db, 'tasks', activeTask.id);
        const startTime = new Date(activeTask.active_session_start!).getTime();
        const durationMinutes = Math.floor((new Date().getTime() - startTime) / 60000);

        await addDoc(collection(db, 'task_sessions'), {
          task_id: activeTask.id,
          user_id: user?.id,
          start_time: activeTask.active_session_start,
          end_time: serverTimestamp(),
          duration_minutes: durationMinutes,
          project_id: activeTask.project_id,
          type: 'break_auto_pause'
        });

        await updateDoc(taskRef, {
          active_session_id: null,
          active_session_start: null,
          is_paused_by_break: true,
          total_minutes_logged: (activeTask.total_minutes_logged || 0) + durationMinutes
        });
        toast('Timer frozen for break', { icon: '❄️' });
      } 
      else if (!isPaused && autoPausedTask) {
        // Automatically resume the task when break ends
        const taskRef = doc(db, 'tasks', autoPausedTask.id);
        await updateDoc(taskRef, {
          active_session_id: 'active',
          active_session_start: serverTimestamp(),
          is_paused_by_break: false
        });
        toast('Timer resumed!', { icon: '▶️' });
      }
    };

    if (tasks.length > 0) {
      syncBreakWithTasks();
    }
  }, [isPaused, tasks.length, user?.id]);

  const fetchMetadata = async () => {
    try {
      // Fetch Projects
      const projSnap = await getDocs(collection(db, 'projects'));
      setProjects(projSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Fetch Employees
      const empSnap = await getDocs(collection(db, 'users'));
      setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const project = projects.find(p => p.id === form.project_id);
      const assignee = employees.find(emp => emp.id === form.assigned_to);
      
      const isAutoApproved = user?.role === 'admin';
      
      // Generate Task ID: 3 letters of assignee + 3 random numbers
      const targetName = assignee?.name || user?.name || 'SYS';
      const prefix = targetName.slice(0, 3).toUpperCase();
      const randomNum = Math.floor(100 + Math.random() * 900);
      const taskCode = `${prefix}${randomNum}`;

      const newTask = {
        ...form,
        project_name: project?.name || 'Unknown Project',
        assignee_name: assignee?.name || 'Unassigned',
        status: isAutoApproved ? 'todo' : 'pending',
        total_minutes_logged: 0,
        active_session_id: null,
        is_approved: isAutoApproved,
        task_code: taskCode,
        created_by: user?.id,
        created_at: serverTimestamp()
      };

      await addDoc(collection(db, 'tasks'), newTask);
      
      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'New Task Assignment',
        message: `${user?.name} has assigned the ${project?.name || 'Project'} to ${assignee?.name || 'Unassigned'}`,
        type: 'task_created',
        is_read: false,
        created_at: serverTimestamp()
      });

      if (!isAutoApproved) {
        await addDoc(collection(db, 'notifications'), {
          user_id: 'admin',
          title: 'New Task Approval',
          message: `${user?.name} created task "${form.title}" — needs your approval`,
          type: 'approval_request',
          is_read: false,
          created_at: serverTimestamp()
        });
      }

      toast.success(isAutoApproved ? 'Task allotted!' : 'Task submitted for approval!');
      setShowCreateModal(false);
      setForm({ title: '', description: '', project_id: '', assigned_to: '', priority: 'medium', due_date: '', estimated_hours: 0 });
    } catch (err) {
      console.error(err);
      toast.error('Failed to create task');
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      const taskRef = doc(db, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        title: selectedTask.title,
        description: selectedTask.description,
        priority: selectedTask.priority,
        due_date: selectedTask.due_date,
        estimated_hours: selectedTask.estimated_hours
      });
      toast.success('Task updated successfully!');
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskToDelete));
      
      // Log deletion for Admin
      await addDoc(collection(db, 'notifications'), {
        user_id: 'admin',
        title: 'Task Deleted 🗑️',
        message: `${user?.name} deleted a task.`,
        type: 'system',
        is_read: false,
        created_at: serverTimestamp()
      });

      toast.success('Task deleted successfully!');
      setShowDeleteModal(false);
      setTaskToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete task');
    }
  };

  const approveTask = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.data();

      await updateDoc(taskRef, { 
        is_approved: true,
        status: 'todo'
      });

      await addDoc(collection(db, 'notifications'), {
        user_id: taskData?.assigned_to,
        title: 'Task Approved! ✅',
        message: `Your task "${taskData?.title}" has been approved. You can now start working.`,
        type: 'approval',
        is_read: false,
        created_at: serverTimestamp()
      });

      toast.success('Task approved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve task');
    }
  };

  const rejectTask = async (taskId: string, reason: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.data();

      await updateDoc(taskRef, { 
        is_approved: false,
        status: 'pending',
        rejection_reason: reason
      });

      await addDoc(collection(db, 'notifications'), {
        user_id: taskData?.assigned_to,
        title: 'Task Rejected ❌',
        message: `Your task "${taskData?.title}" was rejected. Reason: ${reason}`,
        type: 'rejection',
        is_read: false,
        created_at: serverTimestamp()
      });

      toast.error('Task rejected');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject task');
    }
  };

  const toggleTimer = async (taskId: string, isActive: boolean) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      const data = taskSnap.data();

      if (!data?.is_approved && !isActive) {
        toast.error('This task needs admin approval before starting.');
        return;
      }

      if (isActive) {
        // Stop timer
        if (data?.active_session_start) {
          const startTime = data.active_session_start.toDate();
          const durationMinutes = Math.floor((new Date().getTime() - startTime.getTime()) / 60000);
          
          // Log the session
          await addDoc(collection(db, 'task_sessions'), {
            task_id: taskId,
            user_id: user?.id,
            start_time: data.active_session_start,
            end_time: serverTimestamp(),
            duration_minutes: durationMinutes,
            project_id: data.project_id
          });

          await updateDoc(taskRef, {
            active_session_id: null,
            active_session_start: null,
            total_minutes_logged: (data.total_minutes_logged || 0) + durationMinutes
          });
        }
        toast.success('Timer stopped');
      } else {
        // Start timer
        await updateDoc(taskRef, {
          active_session_id: 'active',
          active_session_start: serverTimestamp(),
          status: 'in_progress'
        });
        toast.success('Timer started');
        
        // If they were on break, resume attendance too? 
        // No, let's keep it separate for now or ask user.
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to toggle timer');
    }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, { status: newStatus });
      toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task status');
    }
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Hide tasks created inside projects from the main Tasks page for everyone (they stay in the Project page)
    if (t.is_project_task) return false;

    // Admin sees everything, employees only see their assigned tasks
    if (user?.role === 'admin') return matchesSearch;
    return matchesSearch && (t.assigned_to === user?.id || t.created_by === user?.id);
  });

  const columns = [
    { id: 'pending', title: 'Pending Approval', icon: AlertCircle, color: 'text-rose-500', zone: 'bg-rose-50/50' },
    { id: 'todo', title: 'To Do', icon: Clock, color: 'text-gray-400', zone: 'bg-gray-50' },
    { id: 'in_progress', title: 'In Progress', icon: Play, color: 'text-warning', zone: 'bg-amber-50/30' },
    { id: 'review', title: 'Review', icon: Search, color: 'text-primary', zone: 'bg-indigo-50/30' },
    { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-success', zone: 'bg-emerald-50/30' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">Active Tasks</h2>
          <p className="text-sm text-text-muted font-medium">Sprint cycle: <span className="text-primary">Q2 2026 - Sprint 4</span></p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-gray-100 p-1 rounded-2xl flex items-center shadow-inner">
            <button 
              onClick={() => setView('kanban')}
              className={`p-2.5 rounded-xl transition-all ${view === 'kanban' ? 'bg-white shadow-md text-primary scale-105' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <Layout className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView('list')}
              className={`p-2.5 rounded-xl transition-all ${view === 'list' ? 'bg-white shadow-md text-primary scale-105' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-3 px-6 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search tasks, projects, or team..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input h-14 pl-12 bg-white/70 backdrop-blur-md border-none shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
          />
        </div>
        <button className="h-14 px-6 rounded-2xl glass flex items-center text-sm font-bold text-text-secondary border-none hover:bg-white/80 transition-all shadow-sm">
          <Filter className="w-4 h-4 mr-3" />
          Advanced Filters
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[600px] rounded-[40px]" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
          {columns.map(col => (
            <div key={col.id} className={`rounded-[40px] p-2 transition-colors ${col.zone} min-h-[700px]`}>
              <div className="flex items-center justify-between p-6 mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${col.color.replace('text', 'bg')}`} />
                  <h3 className="font-black text-xs text-text-secondary uppercase tracking-[0.2em]">{col.title}</h3>
                </div>
                <span className="text-[10px] font-black bg-white/80 px-2.5 py-1 rounded-lg text-text-muted shadow-sm ring-1 ring-black/5">
                  {filteredTasks.filter(t => t.status === col.id).length}
                </span>
              </div>
              
              <div className="space-y-5 px-2 pb-6">
                {filteredTasks.filter(t => t.status === col.id).map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => setSelectedTask(task)}
                    className={`group bg-white p-6 rounded-[32px] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer border-2 ${task.active_session_id ? 'border-primary/40 ring-4 ring-primary/5' : 'border-transparent hover:border-primary/10'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2.5 py-1.5 rounded-xl w-fit">
                          {task.project_name}
                        </span>
                        <div className="flex items-center space-x-1.5 text-[10px] font-black text-text-muted bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 group-hover:border-primary/20 transition-colors">
                          <Link className="w-2.5 h-2.5 text-primary/60" />
                          <span className="tracking-tighter">
                            {task.task_code}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <PriorityBadge priority={task.priority} />
                        <div className="relative">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setOpenMenuId(openMenuId === task.id ? null : task.id);
                            }}
                            className={`p-1.5 rounded-lg text-text-muted transition-all ${openMenuId === task.id ? 'bg-gray-100 text-primary' : 'hover:bg-gray-100'}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === task.id && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] animate-in fade-in zoom-in duration-150">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setSelectedTask(task); 
                                  setShowEditModal(true); 
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-text-secondary hover:bg-primary/5 hover:text-primary transition-all"
                              >
                                Edit Task
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setTaskToDelete(task.id); 
                                  setShowDeleteModal(true); 
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-danger hover:bg-danger/5 transition-all"
                              >
                                Delete Task
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <h4 className="font-bold text-base text-text-primary mb-3 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {task.title}
                    </h4>

                    {task.is_paused_by_break && (
                      <div className="mb-4 py-2 px-4 bg-amber-50 text-amber-600 text-[10px] font-black rounded-xl text-center uppercase tracking-widest border border-amber-200 animate-pulse">
                        ⏸ Timer Frozen (Break)
                      </div>
                    )}

                    {!task.is_approved && (
                      <div className="mb-4 space-y-2">
                        {user?.role === 'admin' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); approveTask(task.id); }}
                              className="flex-1 py-2 px-4 bg-success/10 text-success text-xs font-black rounded-xl hover:bg-success hover:text-white transition-all uppercase tracking-widest"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const reason = prompt('Reason for rejection:');
                                if (reason) rejectTask(task.id, reason);
                              }}
                              className="flex-1 py-2 px-4 bg-danger/10 text-danger text-xs font-black rounded-xl hover:bg-danger hover:text-white transition-all uppercase tracking-widest"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : (
                          <div className="py-2 px-4 bg-amber-50 text-amber-600 text-[10px] font-black rounded-xl text-center uppercase tracking-widest">
                            {task.rejection_reason ? '❌ Task Rejected' : '⏳ Awaiting Admin Approval'}
                          </div>
                        )}
                        {task.rejection_reason && (
                          <div className="p-3 bg-danger/5 text-danger text-[10px] font-bold rounded-xl border border-danger/10">
                            Reason: {task.rejection_reason}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTimer(task.id, !!task.active_session_id); }}
                          disabled={!task.is_approved}
                          className={`p-2.5 rounded-xl transition-all ${
                            !task.is_approved 
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : task.active_session_id 
                                ? 'bg-danger text-white animate-pulse' 
                                : 'bg-gray-50 text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'
                          }`}
                        >
                          {task.active_session_id ? <TimerIcon className="w-4 h-4 animate-spin-slow" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">Time Tracked</span>
                          <span className="text-xs font-bold text-text-primary">
                            {task.active_session_id && task.active_session_start ? (
                              <LiveTimer start={task.active_session_start} baseMinutes={task.total_minutes_logged} />
                            ) : formatMinutes(task.total_minutes_logged)}
                          </span>
                        </div>
                      </div>
                      <Avatar name={task.assignee_name || ''} size="xs" className="ring-2 ring-white shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-[40px] overflow-hidden border-none shadow-sm bg-white/40">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/20 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Task Identity</th>
                <th className="px-8 py-6">Progress Zone</th>
                <th className="px-8 py-6">Tracked / Estimated</th>
                <th className="px-8 py-6">Team Lead</th>
                <th className="px-8 py-6 text-center">Execution</th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className={`border-b border-white/10 hover:bg-white/60 transition-all cursor-pointer group ${task.active_session_id ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-text-primary group-hover:text-primary transition-colors">{task.title}</span>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{task.project_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-black text-primary">
                        {task.active_session_id && task.active_session_start ? (
                          <LiveTimer start={task.active_session_start} baseMinutes={task.total_minutes_logged} />
                        ) : formatMinutes(task.total_minutes_logged)}
                      </span>
                      <span className="text-[10px] text-text-muted font-bold">/ {task.estimated_hours}h</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <Avatar name={task.assignee_name} size="xs" />
                      <span className="text-xs font-bold text-text-secondary">{task.assignee_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {!task.is_approved ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg uppercase tracking-tighter">Awaiting Approval</span>
                        {user?.role === 'admin' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); approveTask(task.id); }}
                            className="mt-2 text-[10px] font-black text-success hover:underline"
                          >
                            Approve Now
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleTimer(task.id, !!task.active_session_id); }}
                        className={`p-3 rounded-xl transition-all shadow-sm ${
                          task.active_session_id 
                          ? 'bg-danger text-white hover:bg-danger-hover' 
                          : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                        }`}
                      >
                        {task.active_session_id ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                      </button>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenMenuId(openMenuId === task.id ? null : task.id);
                        }}
                        className={`p-2 rounded-lg text-text-muted transition-all ${openMenuId === task.id ? 'bg-gray-100 text-primary' : 'hover:bg-gray-100'}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === task.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] animate-in fade-in zoom-in duration-150">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setSelectedTask(task); 
                              setShowEditModal(true); 
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-text-secondary hover:bg-primary/5 hover:text-primary transition-all"
                          >
                            Edit Task
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setTaskToDelete(task.id); 
                              setShowDeleteModal(true); 
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-danger hover:bg-danger/5 transition-all"
                          >
                            Delete Task
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white h-full w-full max-w-2xl shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-8 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-text-muted" />
                </button>
                <div className="h-8 w-px bg-gray-200" />
                <span className="text-xs font-black text-text-muted uppercase tracking-widest">{selectedTask.project_name}</span>
              </div>
              <div className="flex items-center space-x-3">
                <button className="btn-secondary h-11 px-5 border-none bg-gray-50 hover:bg-gray-100 font-bold text-xs">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>

            <div className="p-12 space-y-12">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <PriorityBadge priority={selectedTask.priority} />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Task {selectedTask.task_code || `#${selectedTask.id.slice(0, 8)}`}</span>
                </div>
                <h2 className="text-4xl font-black text-text-primary leading-tight">{selectedTask.title}</h2>
              </div>

              <div className="grid grid-cols-2 gap-12 py-8 border-y border-gray-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Zone Status</label>
                  <select 
                    value={selectedTask.status}
                    onChange={(e) => updateStatus(selectedTask.id, e.target.value)}
                    className="w-full h-14 px-5 bg-gray-50 rounded-2xl font-black text-xs uppercase tracking-widest outline-none ring-primary/10 focus:ring-4 transition-all appearance-none cursor-pointer border-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Assigned To</label>
                  <div className="flex items-center space-x-4 h-14 px-5 bg-gray-50 rounded-2xl">
                    <Avatar name={selectedTask.assignee_name} size="xs" />
                    <span className="text-sm font-bold text-text-primary">{selectedTask.assignee_name}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Mission Description</h3>
                <div className="bg-gray-50 p-8 rounded-[32px] text-text-secondary leading-relaxed font-medium whitespace-pre-wrap">
                  {selectedTask.description || 'No description provided for this mission.'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                <div className="p-6 bg-primary/5 rounded-[24px] space-y-2">
                  <Clock className="w-5 h-5 text-primary mb-3" />
                  <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Time Logged</p>
                  <p className="text-xl font-black text-primary">
                    {selectedTask.active_session_id && selectedTask.active_session_start ? (
                      <LiveTimer start={selectedTask.active_session_start} baseMinutes={selectedTask.total_minutes_logged} />
                    ) : formatMinutes(selectedTask.total_minutes_logged)}
                  </p>
                </div>
                <div className="p-6 bg-indigo-50 rounded-[24px] space-y-2">
                  <TimerIcon className="w-5 h-5 text-indigo-600 mb-3" />
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Estimation</p>
                  <p className="text-xl font-black text-indigo-600">{selectedTask.estimated_hours}h</p>
                </div>
                <div className="p-6 bg-emerald-50 rounded-[24px] space-y-2">
                  <Calendar className="w-5 h-5 text-emerald-600 mb-3" />
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Due Date</p>
                  <p className="text-xl font-black text-emerald-600">{new Date(selectedTask.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="pt-8">
                <button 
                  onClick={() => toggleTimer(selectedTask.id, !!selectedTask.active_session_id)}
                  className={`w-full h-16 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center space-x-4 shadow-xl transition-all active:scale-95 ${
                    selectedTask.active_session_id 
                    ? 'bg-danger text-white shadow-danger/25' 
                    : 'bg-primary text-white shadow-primary/25'
                  }`}
                >
                  {selectedTask.active_session_id ? (
                    <>
                      <Square className="w-5 h-5 fill-current" />
                      <span>End Task Session</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Start Working</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-modal animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-xl font-black text-text-primary tracking-tight">New Mission</h3>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Initialize a new task in the sprint</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm hover:text-danger transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              <form onSubmit={handleCreate} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Mission Title</label>
                  <input 
                    type="text" required className="input h-12 px-5 bg-gray-50/50 border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold" 
                    placeholder="e.g. Design System Implementation"
                    value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Project</label>
                    <select 
                      required className="input h-12 px-5 bg-gray-50/50 border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none cursor-pointer"
                      value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}
                    >
                      <option value="">Select Project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Est. Hours</label>
                    <input 
                      type="number" step="0.5" required className="input h-12 px-5 bg-gray-50/50 border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold" 
                      placeholder="e.g. 4.5"
                      value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Lead Assigned</label>
                    <select 
                      required className="input h-12 px-5 bg-gray-50/50 border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none cursor-pointer"
                      value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}
                    >
                      <option value="">Select Team Member</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Priority</label>
                    <select 
                      className="input h-12 px-5 bg-gray-50/50 border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none cursor-pointer"
                      value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Deadline</label>
                    <input 
                      type="date" required className="input h-12 px-5 bg-gray-50/50 border-none rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold"
                      value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                     <div className="flex items-center space-x-2 text-[10px] font-black text-success uppercase tracking-widest bg-success/5 px-4 py-3 rounded-xl w-full">
                       <Save className="w-3 h-3" />
                       <span>Draft Auto-saved</span>
                     </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Mission Briefing</label>
                  <textarea 
                    className="input min-h-[100px] p-5 bg-gray-50/50 border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium leading-relaxed" 
                    placeholder="Define the objectives and requirements..."
                    value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="h-12 px-6 rounded-xl font-bold text-sm text-text-muted hover:bg-gray-100 transition-all">Discard</button>
                  <button type="submit" className="h-12 px-10 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all">Launch Task</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && selectedTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-[40px] p-10 shadow-2xl animate-scale-up">
            <h2 className="text-3xl font-black text-text-primary mb-8">Edit Task</h2>
            <form onSubmit={handleUpdateTask} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Task Title</label>
                <input 
                  type="text" required
                  className="w-full h-14 px-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all"
                  value={selectedTask.title}
                  onChange={(e) => setSelectedTask({...selectedTask, title: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  className="w-full h-32 px-6 py-4 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                  value={selectedTask.description}
                  onChange={(e) => setSelectedTask({...selectedTask, description: e.target.value})}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 h-14 rounded-2xl font-bold text-text-secondary hover:bg-gray-100 transition-all">Cancel</button>
                <button type="submit" className="flex-1 h-14 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-scale-up text-center">
            <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-10 h-10 text-danger" />
            </div>
            <h2 className="text-2xl font-black text-text-primary mb-2">Are you sure?</h2>
            <p className="text-text-muted font-medium mb-8 text-sm">This action cannot be undone. This task will be permanently deleted.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDeleteTask} className="h-14 bg-danger text-white rounded-2xl font-black shadow-lg shadow-danger/20 hover:scale-[1.02] active:scale-95 transition-all">Yes, Delete Task</button>
              <button onClick={() => setShowDeleteModal(false)} className="h-14 rounded-2xl font-bold text-text-secondary hover:bg-gray-100 transition-all">No, Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
