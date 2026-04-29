import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Briefcase, Clock, 
  CheckCircle2, FastForward, MoreVertical, 
  ArrowRight, Search, Layout, Video, Users, User as UserIcon
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, query, getDocs, orderBy, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'planned';
  task_count: number;
  completed_tasks: number;
}

const Sprints: React.FC = () => {
  const { user } = useAuthStore();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeMeetSprint, setActiveMeetSprint] = useState<string | null>(null);
  useTitle('Sprints');

  useEffect(() => {
    fetchSprints();
    fetchMetadata();
  }, []);

  const fetchSprints = async () => {
    try {
      const q = query(
        collection(db, 'sprints'),
        orderBy('start_date', 'desc')
      );
      const snap = await getDocs(q);
      const sprintData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sprint[];
      
      setSprints(sprintData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetadata = async () => {
    const projSnap = await getDocs(collection(db, 'projects'));
    setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const userSnap = await getDocs(collection(db, 'users'));
    setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const startMeet = async (sprint: Sprint, targetUserId?: string) => {
    // Generate a unique meeting room ID for this session
    const roomId = Math.random().toString(36).substring(2, 12);
    const meetLink = `https://meet.google.com/${roomId.slice(0,3)}-${roomId.slice(3,7)}-${roomId.slice(7,10)}`;
    
    const project = projects.find(p => p.id === sprint.project_id);
    let members = project?.members || [];
    
    // If no project members (e.g., global huddle), invite all users
    if (members.length === 0) {
      members = users.map(u => u.id);
    }
    
    try {
      if (targetUserId) {
        // Option A: Specific Member
        await addDoc(collection(db, 'notifications'), {
          user_id: targetUserId,
          title: 'Direct Meeting Invite 🎥',
          message: `${user?.name} (Host) is inviting you to an instant meeting for ${sprint.name}.`,
          type: 'meet_request',
          link: meetLink,
          is_read: false,
          created_at: serverTimestamp()
        });
        toast.success(`Invite sent to ${users.find(u => u.id === targetUserId)?.name}`);
      } else {
        // Option B: All Members
        const batchNotifs = members
          .filter((mId: string) => mId !== user?.id)
          .map((mId: string) => addDoc(collection(db, 'notifications'), {
            user_id: mId,
            title: 'Team Huddle Started 🚀',
            message: `${user?.name} (Host) started a team meeting for ${sprint.name}. Join now!`,
            type: 'meet_request',
            link: meetLink,
            is_read: false,
            created_at: serverTimestamp()
          }));
        await Promise.all(batchNotifs);
        toast.success(`Huddle invite sent to all members`);
      }
      
      // Automatically open meet for initiator
      window.open(meetLink, '_blank');
    } catch (err) {
      console.error(err);
      toast.error('Failed to start meet');
    }
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
          <button 
            onClick={() => {
              const dummySprint = { name: 'Quick Huddle', project_id: projects[0]?.id || '' } as any;
              startMeet(dummySprint);
            }}
            className="flex items-center space-x-3 px-6 h-14 bg-success text-white rounded-2xl font-black shadow-xl shadow-success/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Users className="w-5 h-5" />
            <span>Instant Huddle</span>
          </button>
          {user?.role === 'admin' && (
            <button className="flex items-center space-x-3 px-6 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              <Plus className="w-5 h-5" />
              <span>New Sprint</span>
            </button>
          )}
        </div>
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
          sprints.map((sprint) => {
            const project = projects.find(p => p.id === sprint.project_id);
            const members = project?.members || [];
            
            return (
              <div 
                key={sprint.id} 
                className="group glass p-8 rounded-[40px] border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden flex flex-col"
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

                <div className="space-y-6 mb-8 flex-1">
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

                  {/* Quick Meet Actions */}
                  <div className="pt-4 space-y-3">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Quick Meet</p>
                    <div className="flex gap-2 relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMeetSprint(activeMeetSprint === sprint.id ? null : sprint.id);
                        }}
                        className="flex-1 flex items-center justify-center space-x-2 h-11 bg-white/50 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm"
                      >
                        <UserIcon className="w-3 h-3" />
                        <span>With Member</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startMeet(sprint);
                        }}
                        className="flex-1 flex items-center justify-center space-x-2 h-11 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
                      >
                        <Users className="w-3 h-3" />
                        <span>Meet All</span>
                      </button>

                      {/* Member Selector Dropdown */}
                      {activeMeetSprint === sprint.id && (
                        <div className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-10 animate-in slide-in-from-bottom-2 duration-200" onClick={e => e.stopPropagation()}>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {members.filter((mId: string) => mId !== user?.id).map((mId: string) => {
                              const emp = users.find(u => u.id === mId);
                              return (
                                <button 
                                  key={mId}
                                  onClick={() => {
                                    startMeet(sprint, mId);
                                    setActiveMeetSprint(null);
                                  }}
                                  className="w-full flex items-center space-x-3 p-2 hover:bg-primary/5 rounded-xl transition-all"
                                >
                                  <Avatar name={emp?.name || ''} size="xs" />
                                  <span className="text-xs font-bold text-text-secondary">{emp?.name}</span>
                                </button>
                              );
                            })}
                            {members.length <= 1 && (
                              <p className="text-[10px] text-text-muted p-4 text-center">No other members in this project</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-auto">
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
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sprints;
