import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; import {
  Plus, Search, Filter, MoreVertical,
  Calendar, Users, CheckCircle2, Clock, Briefcase, Lock, Check
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import ProgressBar from '../components/ProgressBar';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'react-hot-toast';

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
  members: string[];
  created_at?: any;
}

const Projects: React.FC = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    client: '',
    deadline: '',
    status: 'active' as const
  });
  const navigate = useNavigate();
  useTitle('Projects');

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    const snap = await getDocs(collection(db, 'users'));
    setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      let q = query(collection(db, 'projects'));

      const querySnapshot = await getDocs(q);
      let projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'active',
        total_tasks: doc.data().total_tasks || 0,
        completed_tasks: doc.data().completed_tasks || 0,
        members: doc.data().members || [],
      })) as Project[];

      // Sort by created_at desc in memory
      projectsData.sort((a, b) => {
        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // In-memory filter for non-admins to ensure visibility without complex index requirements
      if (user?.role !== 'admin' && user?.id) {
        projectsData = projectsData.filter(p => p.members?.includes(user.id));
      }

      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || selectedMembers.length === 0) {
      toast.error('Project name and at least one member are required');
      return;
    }
    try {
      const { addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'projects'), {
        ...newProject,
        members: selectedMembers,
        total_tasks: 0,
        completed_tasks: 0,
        created_at: serverTimestamp(),
        created_by: user?.id
      });
      toast.success('Project created and members assigned!');
      setShowCreateModal(false);
      setNewProject({ name: '', description: '', client: '', deadline: '', status: 'active' });
      setSelectedMembers([]);
      fetchProjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create project');
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
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/30 backdrop-blur-md p-4 rounded-2xl border border-white/20">
        <div className="flex space-x-1">
          {['All', 'Active', 'Completed', 'On Hold'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-white/50'
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
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-80 rounded-[40px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => {
            const isMember = user?.role === 'admin' || project.members?.includes(user?.id || '');
            return (
              <div
                key={project.id}
                onClick={() => {
                  if (isMember) {
                    navigate(`/projects/${project.id}`);
                  } else {
                    toast.error("You are not assigned to this project.");
                  }
                }}
                className={`group glass p-8 rounded-[40px] border-none shadow-sm transition-all relative overflow-hidden ${isMember ? 'hover:shadow-2xl hover:-translate-y-2 cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
              >
                {!isMember && (
                  <div className="absolute top-4 right-4 z-20 bg-white/80 p-2 rounded-xl backdrop-blur-sm shadow-sm">
                    <Lock className="w-5 h-5 text-text-muted" />
                  </div>
                )}

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
                      {project.members?.slice(0, 3).map((mId, i) => {
                        const emp = employees.find(e => e.id === mId);
                        return (
                          <div key={i} className="relative group/avatar">
                            <Avatar name={emp?.name || 'User'} size="xs" className="ring-4 ring-white/50" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[8px] font-black rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap z-30">
                              {emp?.name || 'Loading...'}
                            </div>
                          </div>
                        );
                      })}
                      {project.members?.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary ring-4 ring-white/50">
                          +{project.members.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] p-10 shadow-2xl animate-scale-up overflow-y-auto max-h-[90vh]">
            <h2 className="text-3xl font-black text-text-primary mb-8">Create New Project</h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g., Q2 Marketing Campaign"
                  className="w-full h-14 px-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Description</label>
                <textarea
                  placeholder="What is this project about?"
                  className="w-full h-32 p-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Assign Members</label>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2">
                  {employees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedMembers(prev =>
                          prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                        );
                      }}
                      className={`flex items-center space-x-3 p-3 rounded-2xl border-2 transition-all ${selectedMembers.includes(emp.id) ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                    >
                      <Avatar name={emp.name} size="xs" />
                      <div className="text-left">
                        <p className="text-xs font-black text-text-primary truncate">{emp.name}</p>
                        <p className="text-[10px] text-text-muted font-bold capitalize">{emp.role}</p>
                      </div>
                      {selectedMembers.includes(emp.id) && <Check className="w-4 h-4 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-4 pt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-text-muted uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  className="flex-1 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
