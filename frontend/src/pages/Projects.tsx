import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, MoreVertical, 
  Calendar, Users, CheckCircle2, Clock, Briefcase
} from 'lucide-react';
import api from '../services/api';
import ProgressBar from '../components/ProgressBar';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  creator_name: string;
  total_tasks: number;
  completed_tasks: number;
  start_date: string;
  end_date: string;
}

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();
  useTitle('Projects');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors = {
    active: 'bg-blue-50 text-blue-600',
    completed: 'bg-green-50 text-green-600',
    on_hold: 'bg-amber-50 text-amber-600',
  };

  const filteredProjects = projects.filter(p => 
    filter === 'All' || p.status.toLowerCase().replace('_', ' ') === filter.toLowerCase()
  );

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Projects</h2>
          <p className="text-sm text-text-muted">Manage and track your team's work</p>
        </div>
        <button className="btn-primary flex items-center shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/20">
        <div className="flex space-x-1">
          {['All', 'Active', 'Completed', 'On Hold'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === f ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-white/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="input pl-10 bg-white/50 border-none shadow-sm focus:bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-72 rounded-[32px]" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/20 backdrop-blur-sm rounded-[32px] border border-white/20">
          <Briefcase className="w-16 h-16 text-text-muted mb-4 opacity-20" />
          <p className="text-text-muted font-bold">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map(project => (
            <div 
              key={project.id} 
              onClick={() => navigate(`/projects/${project.id}`)}
              className="glass p-8 rounded-[32px] hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
                <Briefcase className="w-24 h-24 -mr-8 -mt-8 rotate-12" />
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColors[project.status]}`}>
                  {project.status.replace('_', ' ')}
                </div>
                <button className="p-2 text-text-muted hover:bg-white/50 rounded-full transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-xl font-black text-text-primary group-hover:text-primary transition-colors mb-2">
                {project.name}
              </h3>
              <p className="text-sm text-text-muted line-clamp-2 mb-8 font-medium">
                {project.description}
              </p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-text-muted">
                    <span>Task Completion</span>
                    <span>{Math.round((project.completed_tasks / project.total_tasks) * 100 || 0)}%</span>
                  </div>
                  <ProgressBar 
                    progress={(project.completed_tasks / project.total_tasks) * 100} 
                    className="h-2 rounded-full"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/20">
                  <div className="flex items-center text-xs font-bold text-text-muted">
                    <Calendar className="w-4 h-4 mr-2" />
                    {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'No deadline'}
                  </div>
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map(i => (
                      <Avatar key={i} name={`User ${i}`} size="xs" className="ring-4 ring-white/50" />
                    ))}
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary ring-4 ring-white/50">
                      +2
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
