import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, Layout, List, MoreVertical, 
  CheckCircle2, Clock, AlertCircle, Calendar, User, X,
  Play, Square, Timer as TimerIcon, MessageSquare, 
  ChevronRight, ArrowRight, Save, Link
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useTitle } from '../hooks/useTitle';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Avatar from '../components/Avatar';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
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
}

const LiveTimer: React.FC<{ start: string; baseMinutes: number }> = ({ start, baseMinutes }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(start).getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setElapsed(Math.floor((now - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [start]);

  const totalSeconds = (baseMinutes * 60) + elapsed;
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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
    fetchTasks();
    fetchMetadata();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks');
      setTasks(response.data);
      if (selectedTask) {
        const updated = response.data.find((t: Task) => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
      }
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [projRes, empRes] = await Promise.all([
        api.get('/projects'),
        api.get('/employees')
      ]);
      setProjects(projRes.data);
      setEmployees(empRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tasks', form);
      toast.success('Task created successfully');
      setShowCreateModal(false);
      setForm({ title: '', description: '', project_id: '', assigned_to: '', priority: 'medium', due_date: '', estimated_hours: 0 });
      localStorage.removeItem('task_form_backup');
      fetchTasks();
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  const toggleTimer = async (taskId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await api.post(`/tasks/${taskId}/stop`);
        toast.success('Timer stopped');
      } else {
        await api.post(`/tasks/${taskId}/start`);
        toast.success('Timer started');
      }
      fetchTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle timer');
    }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update task status');
    }
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { id: 'todo', title: 'To Do', icon: Clock, color: 'text-gray-400', zone: 'bg-gray-50' },
    { id: 'in_progress', title: 'In Progress', icon: AlertCircle, color: 'text-warning', zone: 'bg-amber-50/30' },
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
            className="btn-primary h-12 px-6 flex items-center shadow-lg shadow-primary/25 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Task
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
                        <div className="flex items-center space-x-1.5 text-[11px] font-black text-text-muted bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 group-hover:border-primary/20 transition-colors">
                          <Link className="w-3 h-3 text-primary/60" />
                          <span className="tracking-tighter">
                            {task.task_code || `#${task.id.slice(0, 5)}`}
                          </span>
                        </div>
                      </div>
                      <PriorityBadge priority={task.priority} />
                    </div>

                    <h4 className="font-bold text-base text-text-primary mb-6 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {task.title}
                    </h4>

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-xl transition-all ${task.active_session_id ? 'bg-danger text-white animate-pulse' : 'bg-gray-50 text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                          {task.active_session_id ? <TimerIcon className="w-4 h-4 animate-spin-slow" /> : <Play className="w-4 h-4 fill-current" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">Time Tracked</span>
                          <span className="text-xs font-bold text-text-primary">
                            {task.active_session_id && task.active_session_start ? (
                              <LiveTimer start={task.active_session_start} baseMinutes={task.total_minutes_logged} />
                            ) : formatMinutes(task.total_minutes_logged)}
                          </span>
                        </div>
                      </div>
                      <Avatar name={task.assignee_name} size="xs" className="ring-2 ring-white shadow-sm" />
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
    </div>
  );
};

export default Tasks;
