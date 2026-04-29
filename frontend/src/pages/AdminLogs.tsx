import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Clock, User, 
  Calendar, ArrowRight, Pause, Play,
  LogIn, LogOut, CheckCircle2
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, query, getDocs, orderBy, where, limit } from 'firebase/firestore';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';
import { format } from 'date-fns';

interface LogEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: 'checkin' | 'checkout' | 'pause' | 'resume' | 'task_start' | 'task_pause' | 'task_resume' | 'task_stop';
  details: string;
  created_at: any;
  duration_minutes?: number;
}

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  useTitle('Admin Logs');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'audit_logs'),
        orderBy('created_at', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const logData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate() || new Date()
      })) as LogEntry[];
      setLogs(logData);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'checkin': return <LogIn className="w-4 h-4 text-success" />;
      case 'checkout': return <LogOut className="w-4 h-4 text-danger" />;
      case 'pause':
      case 'task_pause': return <Pause className="w-4 h-4 text-amber-500" />;
      case 'resume':
      case 'task_resume':
      case 'task_start': return <Play className="w-4 h-4 text-primary" />;
      case 'task_stop': return <CheckCircle2 className="w-4 h-4 text-success" />;
      default: return <Clock className="w-4 h-4 text-text-muted" />;
    }
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Admin Logs</h2>
        <p className="text-sm text-text-muted">Real-time audit trail of all employee activities</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/20">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by employee or details..." 
            className="input pl-10 h-11 bg-white/50 border-none shadow-sm focus:bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select 
            className="input h-11 px-4 bg-white/50 border-none shadow-sm focus:bg-white text-sm font-medium cursor-pointer"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All Actions</option>
            <option value="checkin">Check-in</option>
            <option value="checkout">Check-out</option>
            <option value="pause">Break Start</option>
            <option value="resume">Break End</option>
            <option value="task_start">Task Start</option>
            <option value="task_stop">Task Complete</option>
          </select>
          <button className="h-11 px-4 rounded-xl glass border-none hover:bg-white/80 transition-all shadow-sm">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="glass rounded-[40px] overflow-hidden border-none shadow-sm bg-white/40">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/20 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
              <th className="px-8 py-6">Timestamp</th>
              <th className="px-8 py-6">Employee</th>
              <th className="px-8 py-6">Action</th>
              <th className="px-8 py-6">Details</th>
              <th className="px-8 py-6">Duration</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="border-b border-white/10 animate-pulse">
                  <td colSpan={5} className="px-8 py-6"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-text-muted font-medium italic">No logs found matching your criteria.</td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-white/10 hover:bg-white/60 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text-primary">{format(log.created_at, 'h:mm:ss a')}</span>
                      <span className="text-[10px] font-medium text-text-muted uppercase tracking-widest">{format(log.created_at, 'MMM d, yyyy')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <Avatar name={log.user_name} size="xs" />
                      <span className="text-sm font-bold text-text-secondary">{log.user_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        {getActionIcon(log.action)}
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest">{log.action.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm text-text-muted font-medium max-w-md line-clamp-1">{log.details}</p>
                  </td>
                  <td className="px-8 py-6">
                    {log.duration_minutes ? (
                      <span className="text-xs font-black text-primary bg-primary/5 px-2.5 py-1.5 rounded-xl">
                        {log.duration_minutes} min
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">--</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLogs;
