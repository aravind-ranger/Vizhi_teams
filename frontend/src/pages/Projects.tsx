import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MoreVertical,
  Calendar, Briefcase, Lock, Check, List, Layout
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import ProgressBar from '../components/ProgressBar';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { getProjectsCached, getUsersCached } from '../lib/firestoreCache';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'todo' | 'active' | 'on_hold' | 'drop' | 'completed';
  creator_name: string;
  total_tasks: number;
  completed_tasks: number;
  start_date: string;
  end_date?: string;
  members: string[];
  created_at?: any;
}

const Projects: React.FC = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [newProject, setNewProject] = useState<{
    name: string;
    description: string;
    deadline: string;
    status: Project['status'];
  }>({
    name: '',
    description: '',
    deadline: '',
    status: 'todo'
  });
  const navigate = useNavigate();
  useTitle('Projects');

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    const cachedUsers = await getUsersCached();
    setEmployees(cachedUsers);
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      let projectsData: Project[] = [];

      if (user?.role === 'admin') {
        const snap = await getDocs(collection(db, 'projects'));
        projectsData = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a: any, b: any) => {
            const aTime = a.created_at?.toDate
              ? a.created_at.toDate().getTime()
              : new Date(a.created_at || 0).getTime();
            const bTime = b.created_at?.toDate
              ? b.created_at.toDate().getTime()
              : new Date(b.created_at || 0).getTime();
            return bTime - aTime;
          });
      } else {
        projectsData = await getProjectsCached();

        // In-memory filter for non-admins to ensure visibility without complex index requirements
        if (user?.id) {
          projectsData = projectsData.filter((p: Project) => p.members?.includes(user.id));
        }
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
      const projectRef = await addDoc(collection(db, 'projects'), {
        ...newProject,
        end_date: newProject.deadline,
        members: selectedMembers,
        total_tasks: 0,
        completed_tasks: 0,
        created_at: serverTimestamp(),
        created_by: user?.id
      });

      // Create deadline notification if deadline is within 3 days
      if (newProject.deadline) {
        const now = new Date();
        const endDate = new Date(newProject.deadline);
        const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffMs = endDay.getTime() - todayDay.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 3) {
          const endDateStr = endDay.toLocaleDateString();
          const notificationMsg = `Project "${newProject.name}" is due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${endDateStr}). Please review your tasks.`;
          
          // Send notification to assigned members
          for (const memberId of selectedMembers) {
            await addDoc(collection(db, 'notifications'), {
              user_id: memberId,
              title: `Project deadline: ${newProject.name}`,
              message: notificationMsg,
              type: 'warning',
              link: `/projects/${projectRef.id}`,
              is_read: false,
              created_at: new Date()
            });
          }

          // Also notify all admins
          try {
            const cachedUsers = await getUsersCached();
            const admins = cachedUsers.filter((u: any) => u.role === 'admin');
            for (const admin of admins) {
              await addDoc(collection(db, 'notifications'), {
                user_id: admin.id,
                title: `Project deadline: ${newProject.name}`,
                message: notificationMsg,
                type: 'warning',
                link: `/projects/${projectRef.id}`,
                is_read: false,
                created_at: new Date()
              });
            }
          } catch (err) {
            console.error('Failed to notify admins', err);
          }
        }
      }

      toast.success('Project created and members assigned!');
      setShowCreateModal(false);
      setNewProject({ name: '', description: '', deadline: '', status: 'todo' });
      setSelectedMembers([]);
      fetchProjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create project');
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;
    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        name: selectedProject.name,
        description: selectedProject.description,
        members: selectedMembers,
        status: selectedProject.status,
        end_date: selectedProject.end_date ?? ''
      });

      // Notify if deadline was changed to within 3 days
      if (selectedProject.end_date) {
        const now = new Date();
        const endDate = new Date(selectedProject.end_date);
        const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffMs = endDay.getTime() - todayDay.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 3) {
          const endDateStr = endDay.toLocaleDateString();
          const notificationMsg = `Project "${selectedProject.name}" deadline updated - due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${endDateStr}). Please review your tasks.`;
          
          // Notify assigned members
          for (const memberId of selectedMembers) {
            await addDoc(collection(db, 'notifications'), {
              user_id: memberId,
              title: `Project deadline updated: ${selectedProject.name}`,
              message: notificationMsg,
              type: 'warning',
              link: `/projects/${selectedProject.id}`,
              is_read: false,
              created_at: new Date()
            });
          }

          // Notify admins
          try {
            const cachedUsers = await getUsersCached();
            const admins = cachedUsers.filter((u: any) => u.role === 'admin');
            for (const admin of admins) {
              await addDoc(collection(db, 'notifications'), {
                user_id: admin.id,
                title: `Project deadline updated: ${selectedProject.name}`,
                message: notificationMsg,
                type: 'warning',
                link: `/projects/${selectedProject.id}`,
                is_read: false,
                created_at: new Date()
              });
            }
          } catch (err) {
            console.error('Failed to notify admins', err);
          }
        }
      }

      toast.success('Project updated successfully!');
      setShowEditModal(false);
      fetchProjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete.id));
      toast.success(`Project "${projectToDelete.name}" is deleted`);
      setShowDeleteModal(false);
      setProjectToDelete(null);
      fetchProjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete project');
    }
  };

  const statusColors = {
    todo: 'bg-gray-100 text-gray-600',
    active: 'bg-blue-50 text-blue-600',
    on_hold: 'bg-amber-50 text-amber-600',
    drop: 'bg-red-50 text-red-600',
    completed: 'bg-green-50 text-green-600',
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/30 dark:bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-white/5">
        <div className="flex space-x-1 overflow-x-auto pb-2 sm:pb-0">
          {['All', 'Todo', 'Active', 'On Hold', 'Drop', 'Completed'].map(f => (
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
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-2xl flex items-center shadow-inner flex-1 md:flex-none">
            <button
              onClick={() => setView('grid')}
              className={`flex-1 md:flex-none p-2.5 rounded-xl transition-all ${view === 'grid' ? 'bg-white dark:bg-primary shadow-md text-primary dark:text-white scale-105' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <Layout className="w-4 h-4 mx-auto" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex-1 md:flex-none p-2.5 rounded-xl transition-all ${view === 'list' ? 'bg-white dark:bg-primary shadow-md text-primary dark:text-white scale-105' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <List className="w-4 h-4 mx-auto" />
            </button>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              className="input pl-10 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-primary shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-80 rounded-[40px]" />)}
        </div>
      ) : view === 'grid' ? (
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
                  <div className="absolute top-4 right-4 z-20 bg-white/80 dark:bg-white/10 p-2 rounded-xl backdrop-blur-sm shadow-sm">
                    <Lock className="w-5 h-5 text-text-muted" />
                  </div>
                )}

                <div className="flex justify-between items-start mb-6">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColors[project.status]}`}>
                    {project.status.replace('_', ' ')}
                  </div>
                  {user?.role === 'admin' && (
                    <div className="relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenMenuId(openMenuId === project.id ? null : project.id);
                        }}
                        className={`p-2 rounded-full transition-colors ${openMenuId === project.id ? 'bg-white/50 dark:bg-white/10 text-primary' : 'text-text-muted hover:bg-white/50 dark:hover:bg-white/10'}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === project.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-glass rounded-xl shadow-xl border border-gray-100 dark:border-white/10 py-1 z-[100] animate-in fade-in zoom-in duration-150">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setSelectedProject({ ...project, end_date: project.end_date ?? '' }); 
                              setSelectedMembers(project.members || []);
                              setShowEditModal(true); 
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-text-secondary hover:bg-primary/5 hover:text-primary transition-all"
                          >
                            Edit Project
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setProjectToDelete(project); 
                              setShowDeleteModal(true); 
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-danger hover:bg-danger/5 transition-all"
                          >
                            Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                            <Avatar name={emp?.name || 'User'} size="xs" className="ring-2 ring-white dark:ring-slate-900 shadow-sm" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[8px] font-black rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap z-30">
                              {emp?.name || 'Loading...'}
                            </div>
                          </div>
                        );
                      })}
                      {project.members?.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary ring-2 ring-white dark:ring-slate-900">
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
      ) : (
        <div className="glass rounded-[40px] shadow-sm bg-white/40 dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/20 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Project Info</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6">Progress</th>
                <th className="px-8 py-6 text-right">Team</th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const isMember = user?.role === 'admin' || project.members?.includes(user?.id || '');
                return (
                  <tr
                    key={project.id}
                    onClick={() => {
                      if (isMember) {
                        navigate(`/projects/${project.id}`);
                      } else {
                        toast.error("You are not assigned to this project.");
                      }
                    }}
                    className={`border-b border-white/10 hover:bg-white/60 dark:hover:bg-white/5 transition-all cursor-pointer group ${!isMember ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                          <Briefcase className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-text-primary group-hover:text-primary transition-colors flex items-center">
                            {project.name}
                            {!isMember && <Lock className="w-3 h-3 ml-2 text-text-muted" />}
                          </span>
                          <span className="text-xs text-text-muted font-medium line-clamp-1 mt-0.5">
                            {project.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColors[project.status]}`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3 w-40">
                        <ProgressBar
                          progress={(project.completed_tasks / project.total_tasks) * 100}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-[10px] font-black text-text-muted">
                          {Math.round((project.completed_tasks / project.total_tasks) * 100 || 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex -space-x-2 justify-end">
                        {project.members?.slice(0, 4).map((mId, i) => {
                          const emp = employees.find(e => e.id === mId);
                          return (
                            <Avatar key={i} name={emp?.name || 'User'} size="xs" className="ring-2 ring-white dark:ring-slate-900" />
                          );
                        })}
                        {project.members?.length > 4 && (
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-text-muted ring-2 ring-white dark:ring-slate-900">
                            +{project.members.length - 4}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {user?.role === 'admin' && (
                        <div className="relative inline-block text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === project.id ? null : project.id);
                            }}
                            className={`p-2 rounded-lg text-text-muted transition-all ${openMenuId === project.id ? 'bg-gray-100 dark:bg-white/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {openMenuId === project.id && (
                            <div className="absolute right-full mr-2 top-0 w-48 bg-white dark:bg-glass rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-white/10 py-2 z-[100] animate-in slide-in-from-right-2 fade-in duration-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject({ ...project, end_date: project.end_date ?? '' });
                                  setSelectedMembers(project.members || []);
                                  setShowEditModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-5 py-3 text-sm font-bold text-text-secondary hover:bg-primary/5 hover:text-primary transition-all flex items-center"
                              >
                                <Layout className="w-4 h-4 mr-3" />
                                Edit Project
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(project);
                                  setShowDeleteModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-5 py-3 text-sm font-bold text-danger hover:bg-danger/5 transition-all flex items-center"
                              >
                                <Lock className="w-4 h-4 mr-3" />
                                Delete Project
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-2xl rounded-[40px] p-10 shadow-2xl animate-scale-up overflow-y-auto scrollbar-hide max-h-[90vh]">
            <h2 className="text-3xl font-black text-text-primary mb-8">Create New Project</h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Q2 Marketing Campaign"
                    className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-text-primary"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Description</label>
                <textarea
                  placeholder="What is this project about?"
                  className="w-full h-32 p-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none text-text-primary"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Deadline</label>
                  <input
                    type="date"
                    className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-text-primary"
                    value={newProject.deadline}
                    onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Initial Status</label>
                  <select
                    className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-text-primary appearance-none"
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value as any })}
                  >
                    <option value="todo">Todo</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="drop">Drop</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
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
                      className={`flex items-center space-x-3 p-3 rounded-2xl border-2 transition-all ${selectedMembers.includes(emp.id) ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20'
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
                  className="flex-1 h-14 rounded-2xl font-black text-text-muted uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
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

      {/* Edit Project Modal */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-2xl rounded-[40px] p-10 shadow-2xl animate-scale-up overflow-y-auto scrollbar-hide max-h-[90vh]">
            <h2 className="text-3xl font-black text-text-primary mb-8">Edit Project</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Project Name</label>
                <input
                  type="text"
                  className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-text-primary"
                  value={selectedProject.name}
                  onChange={(e) => setSelectedProject({ ...selectedProject, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Deadline</label>
                  <input
                    type="date"
                    className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-text-primary"
                    value={selectedProject.end_date ?? ''}
                    onChange={(e) => setSelectedProject({ ...selectedProject, end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Status</label>
                  <select
                    className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-text-primary appearance-none"
                    value={selectedProject.status}
                    onChange={(e) => setSelectedProject({ ...selectedProject, status: e.target.value as any })}
                  >
                    <option value="todo">Todo</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="drop">Drop</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Description</label>
                <textarea
                  className="w-full h-32 p-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none text-text-primary"
                  value={selectedProject.description}
                  onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Update Members</label>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2">
                  {employees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedMembers(prev =>
                          prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                        );
                      }}
                      className={`flex items-center space-x-3 p-3 rounded-2xl border-2 transition-all ${selectedMembers.includes(emp.id) ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20'
                        }`}
                    >
                      <Avatar name={emp.name} size="xs" />
                      <div className="text-left">
                        <p className="text-xs font-black text-text-primary truncate">{emp.name}</p>
                      </div>
                      {selectedMembers.includes(emp.id) && <Check className="w-4 h-4 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex space-x-4 pt-6">
                <button onClick={() => setShowEditModal(false)} className="flex-1 h-14 rounded-2xl font-black text-text-muted uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-white/10 transition-all">Cancel</button>
                <button onClick={handleUpdateProject} className="flex-1 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-scale-up text-center">
            <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-10 h-10 text-danger" />
            </div>
            <h2 className="text-2xl font-black text-text-primary mb-2">Delete Project?</h2>
            <p className="text-text-muted font-medium mb-8 text-sm">Are you sure you want to delete "{projectToDelete.name}"? All associated data will be lost.</p>
            <div className="flex flex-col gap-3">
               <button onClick={handleDeleteProject} className="h-14 bg-danger text-white rounded-2xl font-black shadow-lg shadow-danger/20 hover:scale-[1.02] active:scale-95 transition-all">Yes, Delete Project</button>
              <button onClick={() => setShowDeleteModal(false)} className="h-14 rounded-2xl font-bold text-text-secondary hover:bg-gray-100 dark:hover:bg-white/10 transition-all">No, Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
