import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Briefcase, Clock, 
  CheckCircle2, FastForward, MoreVertical, 
  ArrowRight, Search, Layout
} from 'lucide-react';
import api from '../services/api';
import { useTitle } from '../hooks/useTitle';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';

interface Sprint {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'planned';
  task_count: number;
  completed_tasks: number;
}

const Sprints: React.FC = () => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useTitle('Sprints');

  useEffect(() => {
    fetchSprints();
  }, []);

  const fetchSprints = async () => {
    try {
      const res = await api.get('/sprint');
      setSprints(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgress = (sprint: Sprint) => {
    if (sprint.task_count === 0) return 0;
    return Math.round((sprint.completed_tasks / sprint.task_count) * 100);
  };

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">Active Sprints</h2>
          <p className="text-text-muted mt-1 font-medium">Manage your delivery cycles and velocity</p>
        </div>
        <button className="flex items-center space-x-3 px-6 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          <Plus className="w-5 h-5" />
          <span>New Sprint</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="skeleton h-80 rounded-[40px]" />)
        ) : sprints.length === 0 ? (
          <div className="col-span-full glass p-20 text-center rounded-[40px] border-dashed border-2 border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FastForward className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">No Sprints Found</h3>
            <p className="text-text-muted max-w-xs mx-auto font-medium">Create your first sprint to start tracking your team's velocity.</p>
          </div>
        ) : (
          sprints.map((sprint) => (
            <div 
              key={sprint.id} 
              className="group glass p-8 rounded-[40px] border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex flex-col space-y-1">
                   <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2.5 py-1.5 rounded-xl w-fit">
                    {sprint.project_name}
                  </span>
                  <h3 className="text-xl font-black text-text-primary mt-2">{sprint.name}</h3>
                </div>
                <StatusBadge status={sprint.status} />
              </div>

              <div className="space-y-6 mb-8">
                <div className="flex items-center justify-between text-sm font-bold">
                  <div className="flex items-center text-text-muted">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(sprint.start_date).toLocaleDateString()}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                  <div className="flex items-center text-text-muted">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(sprint.end_date).toLocaleDateString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                    <span>Sprint Progress</span>
                    <span>{getProgress(sprint)}%</span>
                  </div>
                  <ProgressBar progress={getProgress(sprint)} className="h-2.5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <p className="text-lg font-black text-text-primary">{sprint.task_count}</p>
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Tasks</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-center">
                    <p className="text-lg font-black text-success">{sprint.completed_tasks}</p>
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Done</p>
                  </div>
                </div>
                <div className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <MoreVertical className="w-5 h-5 text-text-muted" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sprints;
