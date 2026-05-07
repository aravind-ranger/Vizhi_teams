import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Clock, CheckCircle2, FastForward, MoreVertical,
  Users, User as UserIcon, X, Check, Trash2, Edit2, Video
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, getDocs, doc, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useTitle } from '../hooks/useTitle';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'react-hot-toast';
import Avatar from '../components/Avatar';

interface Sprint {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  start_date?: string;
  end_date?: string;
  meeting_time?: string;
  audience?: 'all' | 'individual';
  selected_members?: string[];
  status: 'active' | 'completed' | 'planned';
  task_count: number;
  completed_tasks: number;
  goal?: string;
}

const Sprints: React.FC = () => {
  const { user } = useAuthStore();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeMeetSprint, setActiveMeetSprint] = useState<string | null>(null);

  const [showMeetModal, setShowMeetModal] = useState(false);
  const [meetTitle, setMeetTitle] = useState('');
  const [meetDesc, setMeetDesc] = useState('');
  const [meetAudience, setMeetAudience] = useState<'all' | 'individual'>('all');
  const [meetSelectedUsers, setMeetSelectedUsers] = useState<string[]>([]);

  const [showNewSprintModal, setShowNewSprintModal] = useState(false);
  const [newSprintData, setNewSprintData] = useState({ name: '', project_id: '', goal: '', meeting_time: '' });
  const [sprintAudience, setSprintAudience] = useState<'all' | 'individual'>('all');
  const [sprintSelectedUsers, setSprintSelectedUsers] = useState<string[]>([]);

  const [showEditSprintModal, setShowEditSprintModal] = useState(false);
  const [editSprintData, setEditSprintData] = useState<Sprint | null>(null);
  const [editAudience, setEditAudience] = useState<'all' | 'individual'>('all');
  const [editSelectedUsers, setEditSelectedUsers] = useState<string[]>([]);

  const [deleteSprintId, setDeleteSprintId] = useState<string | null>(null);
  const [activeSprintDropdown, setActiveSprintDropdown] = useState<string | null>(null);
  const remindersFiredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const closeDropdown = () => setActiveSprintDropdown(null);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  useTitle('Sprints');

  useEffect(() => { fetchSprints(); fetchMetadata(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      sprints.forEach(sprint => {
        if (!sprint.meeting_time) return;
        const key = sprint.id;
        if (remindersFiredRef.current.has(key)) return;
        const [h, m] = sprint.meeting_time.split(':').map(Number);
        const meetTime = new Date();
        meetTime.setHours(h, m, 0, 0);
        const diff = (meetTime.getTime() - now.getTime()) / 60000;
        if (diff > 0 && diff <= 15) {
          const isForMe = sprint.audience === 'all' || (sprint.selected_members || []).includes(user?.id || '');
          if (isForMe || user?.role === 'admin') {
            toast(`"${sprint.name}" starts in ${Math.ceil(diff)} min!`, { duration: 8000, icon: '🔔' });
            remindersFiredRef.current.add(key);
          }
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [sprints, user]);

  const fetchSprints = async () => {
    try {
      const snap = await getDocs(collection(db, 'sprints'));
      setSprints(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Sprint[]);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const fetchMetadata = async () => {
    const projSnap = await getDocs(collection(db, 'projects'));
    setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const userSnap = await getDocs(collection(db, 'users'));
    setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const startMeet = async (sprint: Sprint, targetUserId?: string) => {
    const roomId = Math.random().toString(36).substring(2, 12);
    const meetLink = `https://meet.google.com/${roomId.slice(0,3)}-${roomId.slice(3,7)}-${roomId.slice(7,10)}`;
    const project = projects.find(p => p.id === sprint.project_id);
    let members = project?.members || [];
    if (members.length === 0) members = users.map((u: any) => u.id);
    try {
      if (targetUserId) {
        await addDoc(collection(db, 'notifications'), {
          user_id: targetUserId, title: 'Direct Meeting Invite 🎥',
          message: `${user?.name} is inviting you to a meeting for ${sprint.name}.`,
          type: 'meet_request', link: meetLink, is_read: false, created_at: serverTimestamp()
        });
        toast.success(`Invite sent to ${users.find((u: any) => u.id === targetUserId)?.name}`);
      } else {
        const notifs = members.filter((mId: string) => mId !== user?.id).map((mId: string) =>
          addDoc(collection(db, 'notifications'), {
            user_id: mId, title: 'Team Huddle Started 🚀',
            message: `${user?.name} started a team meeting for ${sprint.name}. Join now!`,
            type: 'meet_request', link: meetLink, is_read: false, created_at: serverTimestamp()
          })
        );
        await Promise.all(notifs);
        toast.success('Huddle invite sent to all members');
      }
      window.open(meetLink, '_blank');
    } catch (err) { console.error(err); toast.error('Failed to start meet'); }
  };

  const handleCreateMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetTitle.trim()) { toast.error('Meeting title is required'); return; }
    try {
      const meetData = {
        title: meetTitle, description: meetDesc, host_id: user?.id, host_name: user?.name,
        audience: meetAudience, selected_members: meetAudience === 'individual' ? meetSelectedUsers : users.map((u: any) => u.id),
        link: 'https://discord.gg/5bXCQFgRxN', created_at: serverTimestamp()
      };
      await addDoc(collection(db, 'meets'), meetData);
      const targetUsers = meetAudience === 'individual' ? meetSelectedUsers : users.map((u: any) => u.id);
      const notifs = targetUsers.filter((mId: string) => mId !== user?.id).map((mId: string) =>
        addDoc(collection(db, 'notifications'), {
          user_id: mId, title: 'Meeting Invitation 🎥',
          message: `${user?.name} has invited you to a meeting`, type: 'meet_request',
          link: 'https://discord.gg/5bXCQFgRxN', is_read: false, created_at: serverTimestamp()
        })
      );
      await Promise.all(notifs);
      toast.success('Meeting created and invitations sent!');
      setShowMeetModal(false); setMeetTitle(''); setMeetDesc(''); setMeetSelectedUsers([]); setMeetAudience('all');
    } catch (err) { console.error(err); toast.error('Failed to create meeting'); }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintData.name || !newSprintData.project_id || !newSprintData.meeting_time) {
      toast.error('Sprint name, project and meeting time are required'); return;
    }
    if (sprintAudience === 'individual' && sprintSelectedUsers.length === 0) {
      toast.error('Select at least one member'); return;
    }
    try {
      const selectedProject = projects.find(p => p.id === newSprintData.project_id);
      const targetMembers = sprintAudience === 'all' ? users.map((u: any) => u.id) : sprintSelectedUsers;
      await addDoc(collection(db, 'sprints'), {
        name: newSprintData.name, project_id: newSprintData.project_id,
        project_name: selectedProject?.name || 'Unknown Project',
        goal: newSprintData.goal, meeting_time: newSprintData.meeting_time,
        audience: sprintAudience, selected_members: targetMembers,
        status: 'planned', task_count: 0, completed_tasks: 0, created_at: serverTimestamp()
      });
      const notifs = targetMembers.filter((id: string) => id !== user?.id).map((id: string) =>
        addDoc(collection(db, 'notifications'), {
          user_id: id, title: 'Sprint Meeting Scheduled 📅',
          message: `${user?.name} has scheduled "${newSprintData.name}" at ${newSprintData.meeting_time}. Be ready!`,
          type: 'sprint_scheduled', is_read: false, created_at: serverTimestamp()
        })
      );
      await Promise.all(notifs);
      toast.success('Sprint created & notifications sent!');
      setShowNewSprintModal(false);
      setNewSprintData({ name: '', project_id: '', goal: '', meeting_time: '' });
      setSprintAudience('all'); setSprintSelectedUsers([]); fetchSprints();
    } catch (err) { console.error(err); toast.error('Failed to create sprint'); }
  };

  const handleEditSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSprintData) return;
    try {
      const targetMembers = editAudience === 'all' ? users.map((u: any) => u.id) : editSelectedUsers;
      await updateDoc(doc(db, 'sprints', editSprintData.id), {
        name: editSprintData.name, project_id: editSprintData.project_id,
        project_name: projects.find(p => p.id === editSprintData.project_id)?.name || editSprintData.project_name,
        goal: editSprintData.goal, meeting_time: editSprintData.meeting_time,
        audience: editAudience, selected_members: targetMembers,
      });
      toast.success('Sprint updated!');
      setShowEditSprintModal(false); setEditSprintData(null); fetchSprints();
    } catch (err) { console.error(err); toast.error('Failed to update sprint'); }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    try {
      await deleteDoc(doc(db, 'sprints', sprintId));
      toast.success('Sprint deleted'); setDeleteSprintId(null); fetchSprints();
    } catch (err) { console.error(err); toast.error('Failed to delete sprint'); }
  };

  const getProgress = (sprint: Sprint) => {
    if (sprint.task_count === 0) return 0;
    return Math.round((sprint.completed_tasks / sprint.task_count) * 100);
  };

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">Active Sprints</h2>
          <p className="text-text-muted mt-1 font-medium">Manage your delivery cycles and velocity</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowMeetModal(true)} className="flex items-center space-x-3 px-6 h-14 bg-success text-white rounded-2xl font-black shadow-xl shadow-success/20 hover:scale-[1.02] active:scale-95 transition-all">
            <Video className="w-5 h-5" /><span>Sprint</span>
          </button>
          {user?.role === 'admin' && (
            <button onClick={() => setShowNewSprintModal(true)} className="flex items-center space-x-3 px-6 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              <Plus className="w-5 h-5" /><span>New Sprint</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-80 rounded-[40px]" />
          ))
        ) : sprints.length === 0 ? (
          <div className="col-span-full glass p-20 text-center rounded-[40px] border-solid border-2 border-gray-200 dark:border-white/10">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FastForward className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">No Sprints Found</h3>
            <p className="text-text-muted max-w-xs mx-auto font-medium">Create your first sprint to start tracking velocity.</p>
          </div>
        ) : (
          sprints.map((sprint) => {
            const project = projects.find(p => p.id === sprint.project_id);
            const members = project?.members || [];
            return (
              <div key={sprint.id} className="group glass p-8 rounded-[40px] border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden flex flex-col">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex flex-col space-y-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2.5 py-1.5 rounded-xl w-fit">{sprint.project_name}</span>
                    <h3 className="text-xl font-black text-text-primary mt-2">{sprint.name}</h3>
                    {sprint.goal && <p className="text-xs text-text-muted mt-1 line-clamp-2">{sprint.goal}</p>}
                  </div>
                  <StatusBadge status={sprint.status} />
                </div>

                <div className="space-y-6 mb-8 flex-1">
                  {sprint.meeting_time && (
                    <div className="flex items-center text-text-muted text-sm font-bold">
                      <Clock className="w-4 h-4 mr-2" />Meeting at {sprint.meeting_time}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                      <span>Sprint Progress</span><span>{getProgress(sprint)}%</span>
                    </div>
                    <ProgressBar progress={getProgress(sprint)} className="h-2.5" />
                  </div>
                  <div className="pt-2 space-y-3">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Quick Meet</p>
                    <div className="flex gap-2 relative">
                      <button onClick={(e) => { e.stopPropagation(); setActiveMeetSprint(activeMeetSprint === sprint.id ? null : sprint.id); }} className="flex-1 flex items-center justify-center space-x-2 h-11 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm">
                        <UserIcon className="w-3 h-3" /><span>With Member</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); startMeet(sprint); }} className="flex-1 flex items-center justify-center space-x-2 h-11 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20">
                        <Users className="w-3 h-3" /><span>Meet All</span>
                      </button>
                      {activeMeetSprint === sprint.id && (
                        <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 p-2 z-10" onClick={e => e.stopPropagation()}>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {members.filter((mId: string) => mId !== user?.id).map((mId: string) => {
                              const emp = users.find((u: any) => u.id === mId);
                              return (
                                <button key={mId} onClick={() => { startMeet(sprint, mId); setActiveMeetSprint(null); }} className="w-full flex items-center space-x-3 p-2 hover:bg-primary/5 dark:hover:bg-white/10 rounded-xl transition-all">
                                  <Avatar name={emp?.name || ''} size="xs" />
                                  <span className="text-xs font-bold text-text-secondary dark:text-gray-200">{emp?.name}</span>
                                </button>
                              );
                            })}
                            {members.length <= 1 && <p className="text-[10px] text-text-muted p-4 text-center">No other members</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-white/5 mt-auto">
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-lg font-black text-text-primary">{sprint.task_count}</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Tasks</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100 dark:bg-white/5" />
                    <div className="text-center">
                      <p className="text-lg font-black text-success">{sprint.completed_tasks}</p>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Done</p>
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setActiveSprintDropdown(activeSprintDropdown === sprint.id ? null : sprint.id); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                        <MoreVertical className="w-5 h-5 text-text-muted" />
                      </button>
                      {activeSprintDropdown === sprint.id && (
                        <div className="absolute bottom-full right-0 mb-2 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-white/10 z-20 py-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditSprintData(sprint); setEditAudience(sprint.audience || 'all'); setEditSelectedUsers(sprint.selected_members || []); setShowEditSprintModal(true); setActiveSprintDropdown(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-text-secondary dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center space-x-2">
                            <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                          </button>
                          <button onClick={() => { setDeleteSprintId(sprint.id); setActiveSprintDropdown(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger/10 flex items-center space-x-2">
                            <Trash2 className="w-3.5 h-3.5" /><span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Meet Modal */}
      {showMeetModal && (
        <div onClick={() => setShowMeetModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-gray-100 dark:border-white/10">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h3 className="text-xl font-black text-text-primary">Create Sprint Meeting</h3>
              <button onClick={() => setShowMeetModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-text-muted" /></button>
            </div>
            <form onSubmit={handleCreateMeet} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Meeting Title *</label>
                <input type="text" required value={meetTitle} onChange={e => setMeetTitle(e.target.value)} className="input-field" placeholder="e.g. Daily Standup" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Description</label>
                <textarea value={meetDesc} onChange={e => setMeetDesc(e.target.value)} className="w-full p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none font-medium text-sm text-text-primary resize-none h-24" placeholder="Meeting agenda..." />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Audience</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setMeetAudience('all')} className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${meetAudience === 'all' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-white/5 text-text-muted border-gray-200 dark:border-white/10'}`}><Users className="w-3.5 h-3.5 inline mr-1" />All Members</button>
                  <button type="button" onClick={() => setMeetAudience('individual')} className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${meetAudience === 'individual' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-white/5 text-text-muted border-gray-200 dark:border-white/10'}`}><UserIcon className="w-3.5 h-3.5 inline mr-1" />Individual</button>
                </div>
                {meetAudience === 'individual' && (
                  <div className="h-40 overflow-y-auto bg-gray-50 dark:bg-white/5 rounded-xl p-2 space-y-1 border border-gray-200 dark:border-white/10">
                    {users.filter((u: any) => u.id !== user?.id).map((u: any) => {
                      const isSel = meetSelectedUsers.includes(u.id);
                      return (
                        <div key={u.id} onClick={() => setMeetSelectedUsers(prev => isSel ? prev.filter(id => id !== u.id) : [...prev, u.id])} className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer ${isSel ? 'bg-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSel ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600'}`}>{isSel && <Check className="w-3 h-3" />}</div>
                          <Avatar name={u.name} size="xs" /><span className="text-sm font-bold text-text-secondary">{u.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowMeetModal(false)} className="flex-1 h-14 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl border border-gray-200 dark:border-white/10">Cancel</button>
                <button type="submit" className="flex-1 h-14 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-95">Create Meeting</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Sprint Modal */}
      {showNewSprintModal && (
        <div onClick={() => setShowNewSprintModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-gray-100 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h3 className="text-xl font-black text-text-primary">Create New Sprint</h3>
              <button onClick={() => setShowNewSprintModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-text-muted" /></button>
            </div>
            <form onSubmit={handleCreateSprint} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Sprint Name *</label>
                <input type="text" required value={newSprintData.name} onChange={e => setNewSprintData({...newSprintData, name: e.target.value})} className="input-field" placeholder="e.g. Sprint 42" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Project *</label>
                <select required value={newSprintData.project_id} onChange={e => setNewSprintData({...newSprintData, project_id: e.target.value})} className="input-field appearance-none dark:text-white">
                  <option value="" className="dark:bg-slate-800">Select a Project</option>
                  {projects.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-800">{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Sprint Goal</label>
                  <button type="button" onClick={() => { const goals = ['Deliver core MVP features.','Fix bugs and optimize performance.','Complete UI redesign.','Implement AI features.']; setNewSprintData({...newSprintData, goal: goals[Math.floor(Math.random()*goals.length)]}); toast.success('Goal generated!'); }} className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded">✨ Auto-Generate</button>
                </div>
                <textarea value={newSprintData.goal} onChange={e => setNewSprintData({...newSprintData, goal: e.target.value})} className="w-full p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none font-medium text-sm text-text-primary resize-none h-20" placeholder="Sprint objective..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Meeting Time *</label>
                <input type="time" required value={newSprintData.meeting_time} onChange={e => setNewSprintData({...newSprintData, meeting_time: e.target.value})} className="input-field" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Notify</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSprintAudience('all')} className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${sprintAudience === 'all' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-white/5 text-text-muted border-gray-200 dark:border-white/10'}`}><Users className="w-3.5 h-3.5 inline mr-1" />All Members</button>
                  <button type="button" onClick={() => setSprintAudience('individual')} className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${sprintAudience === 'individual' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-white/5 text-text-muted border-gray-200 dark:border-white/10'}`}><UserIcon className="w-3.5 h-3.5 inline mr-1" />Individual</button>
                </div>
                {sprintAudience === 'individual' && (
                  <div className="h-40 overflow-y-auto bg-gray-50 dark:bg-white/5 rounded-xl p-2 space-y-1 border border-gray-200 dark:border-white/10">
                    {users.filter((u: any) => u.id !== user?.id).map((u: any) => {
                      const isSel = sprintSelectedUsers.includes(u.id);
                      return (
                        <div key={u.id} onClick={() => setSprintSelectedUsers(prev => isSel ? prev.filter(id => id !== u.id) : [...prev, u.id])} className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer ${isSel ? 'bg-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSel ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600'}`}>{isSel && <Check className="w-3 h-3" />}</div>
                          <Avatar name={u.name} size="xs" /><span className="text-sm font-bold text-text-secondary dark:text-gray-200">{u.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowNewSprintModal(false)} className="flex-1 h-14 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl border border-gray-200 dark:border-white/10">Cancel</button>
                <button type="submit" className="flex-1 h-14 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-95">Create Sprint</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sprint Modal */}
      {showEditSprintModal && editSprintData && (
        <div onClick={() => setShowEditSprintModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-gray-100 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h3 className="text-xl font-black text-text-primary">Edit Sprint</h3>
              <button onClick={() => setShowEditSprintModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-text-muted" /></button>
            </div>
            <form onSubmit={handleEditSprint} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Sprint Name *</label>
                <input type="text" required value={editSprintData.name} onChange={e => setEditSprintData({...editSprintData, name: e.target.value})} className="input-field" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Project *</label>
                <select required value={editSprintData.project_id} onChange={e => setEditSprintData({...editSprintData, project_id: e.target.value})} className="input-field appearance-none dark:text-white">
                  {projects.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-800">{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Sprint Goal</label>
                <textarea value={editSprintData.goal || ''} onChange={e => setEditSprintData({...editSprintData, goal: e.target.value})} className="w-full p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none font-medium text-sm text-text-primary resize-none h-20" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Meeting Time *</label>
                <input type="time" required value={editSprintData.meeting_time || ''} onChange={e => setEditSprintData({...editSprintData, meeting_time: e.target.value})} className="input-field" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Notify</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditAudience('all')} className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${editAudience === 'all' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-white/5 text-text-muted border-gray-200 dark:border-white/10'}`}><Users className="w-3.5 h-3.5 inline mr-1" />All Members</button>
                  <button type="button" onClick={() => setEditAudience('individual')} className={`flex-1 h-11 rounded-xl text-xs font-black transition-all border ${editAudience === 'individual' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-white/5 text-text-muted border-gray-200 dark:border-white/10'}`}><UserIcon className="w-3.5 h-3.5 inline mr-1" />Individual</button>
                </div>
                {editAudience === 'individual' && (
                  <div className="h-40 overflow-y-auto bg-gray-50 dark:bg-white/5 rounded-xl p-2 space-y-1 border border-gray-200 dark:border-white/10">
                    {users.filter((u: any) => u.id !== user?.id).map((u: any) => {
                      const isSel = editSelectedUsers.includes(u.id);
                      return (
                        <div key={u.id} onClick={() => setEditSelectedUsers(prev => isSel ? prev.filter(id => id !== u.id) : [...prev, u.id])} className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer ${isSel ? 'bg-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSel ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600'}`}>{isSel && <Check className="w-3 h-3" />}</div>
                          <Avatar name={u.name} size="xs" /><span className="text-sm font-bold text-text-secondary dark:text-gray-200">{u.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setShowEditSprintModal(false)} className="flex-1 h-14 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl border border-gray-200 dark:border-white/10">Cancel</button>
                <button type="submit" className="flex-1 h-14 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-95">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Sprint Confirm */}
      {deleteSprintId && (
        <div onClick={() => setDeleteSprintId(null)} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[30px] shadow-2xl w-full max-w-sm p-8 border border-gray-100 dark:border-white/10 text-center animate-scale-up">
            <Trash2 className="w-12 h-12 text-danger mx-auto mb-4" />
            <h3 className="text-xl font-black text-text-primary mb-2">Delete Sprint?</h3>
            <p className="text-sm text-text-muted mb-8">This sprint will be permanently removed.</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteSprintId(null)} className="flex-1 h-12 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl border border-gray-200 dark:border-white/10">No</button>
              <button onClick={() => handleDeleteSprint(deleteSprintId)} className="flex-1 h-12 bg-danger text-white font-black rounded-2xl hover:bg-danger/80 shadow-lg shadow-danger/20 active:scale-95">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sprints;
