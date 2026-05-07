import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Plus, MoreHorizontal, Calendar, 
  List, Layout, Settings, Users, X, Clock
} from 'lucide-react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { db } from '../firebase.ts';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import KanbanColumn from '../components/KanbanColumn';
import KanbanTask from '../components/KanbanTask';
import Avatar from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

import { useAuthStore } from '../store/useAuthStore';
import { useAttendanceStore } from '../store/useAttendanceStore';
import { toast } from 'react-hot-toast';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'active' | 'completed' | 'planned' | 'pending' | 'paused_by_break';
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  assignee_id: string;
  due_date: string;
  task_code: string;
  assigned_to: string;
  is_project_task?: boolean;
  created_by?: string;
  active_session_id?: string;
  active_session_start?: string;
  is_paused_by_break?: boolean;
  total_minutes_logged?: number;
}

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' }
] as const;

const ProjectDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Kanban');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium' as const,
    due_date: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { attendance } = useAttendanceStore();
  const isPaused = attendance?.is_paused || false;

  useEffect(() => {
    fetchMetadata();
    
    // Real-time listener for project tasks
    if (!id) return;
    
    const projectRef = doc(db, 'projects', id);
    getDoc(projectRef).then(snap => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() });
    });

    const tasksRef = collection(db, 'tasks');
    const qTasks = query(tasksRef, where('project_id', '==', id));

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        due_date: doc.data().due_date?.toDate?.()?.toISOString() || doc.data().due_date,
        active_session_start: doc.data().active_session_start?.toDate?.()?.toISOString() || doc.data().active_session_start,
      })) as any);
    });

    const sprintsRef = collection(db, 'sprints');
    const qSprints = query(sprintsRef, where('project_id', '==', id));
    const unsubscribeSprints = onSnapshot(qSprints, (snapshot) => {
      setSprints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeSprints();
    };
  }, [id, user?.id]);

  // Sync tasks with Attendance Breaks
  useEffect(() => {
    const syncBreakWithTasks = async () => {
      const activeTask = tasks.find(t => t.active_session_id === 'active' && t.assigned_to === user?.id);
      const autoPausedTask = tasks.find(t => t.is_paused_by_break === true && t.assigned_to === user?.id);

      if (isPaused && activeTask) {
        const taskRef = doc(db, 'tasks', activeTask.id);
        const startTime = new Date(activeTask.active_session_start!).getTime();
        const durationMinutes = Math.floor((new Date().getTime() - startTime) / 60000);

        await addDoc(collection(db, 'task_sessions'), {
          task_id: activeTask.id,
          user_id: user?.id,
          start_time: (activeTask as any).active_session_start,
          end_time: serverTimestamp(),
          duration_minutes: durationMinutes,
          project_id: id,
          type: 'break_auto_pause'
        });

        await updateDoc(taskRef, {
          active_session_id: null,
          active_session_start: null,
          is_paused_by_break: true,
          status: 'paused_by_break',
          total_minutes_logged: ((activeTask as any).total_minutes_logged || 0) + durationMinutes
        });
        toast('Timer frozen for break', { icon: '❄️' });
      } 
      else if (!isPaused && autoPausedTask) {
        const taskRef = doc(db, 'tasks', autoPausedTask.id);
        await updateDoc(taskRef, {
          active_session_id: 'active',
          active_session_start: serverTimestamp(),
          is_paused_by_break: false,
          status: 'in_progress'
        });
        toast('Timer resumed!', { icon: '▶️' });
      }
    };

    if (tasks.length > 0) {
      syncBreakWithTasks();
    }
  }, [isPaused, tasks.length]);

  const fetchMetadata = async () => {
    const empSnap = await getDocs(collection(db, 'users'));
    setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const updateProjectProgress = async () => {
    if (!id) return;
    try {
      const q = query(collection(db, 'tasks'), where('project_id', '==', id));
      const snap = await getDocs(q);
      const allTasks = snap.docs.map(d => d.data());
      const total = allTasks.length;
      const completed = allTasks.filter(t => t.status === 'done').length;
      
      await updateDoc(doc(db, 'projects', id), {
        total_tasks: total,
        completed_tasks: completed
      });
      
      // Update local project state
      setProject((prev: any) => ({ ...prev, total_tasks: total, completed_tasks: completed }));
    } catch (err) {
      console.error('Error updating project progress:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !form.title || !form.assigned_to) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const assignee = employees.find(e => e.id === form.assigned_to);
      const isAutoApproved = user?.role === 'admin' || user?.role === 'manager';
      
      // Generate Task ID: 3 letters of assignee + 3 random numbers
      const targetName = assignee?.name || user?.name || 'SYS';
      const prefix = targetName.slice(0, 3).toUpperCase();
      const randomNum = Math.floor(100 + Math.random() * 900);
      const taskCode = `${prefix}${randomNum}`;

      const newTask = {
        ...form,
        project_id: id,
        project_name: project?.name || 'Project',
        assigned_to: form.assigned_to,
        assignee_id: form.assigned_to,
        assignee_name: assignee?.name || 'Unassigned',
        status: isAutoApproved ? 'todo' : 'pending',
        is_approved: isAutoApproved,
        task_code: taskCode,
        is_project_task: true,
        created_by: user?.id,
        created_at: serverTimestamp()
      };

      await addDoc(collection(db, 'tasks'), newTask);
      
      // Admin notification for approval (if employee created)
      if (!isAutoApproved) {
        await addDoc(collection(db, 'notifications'), {
          user_id: 'admin',
          title: 'Task Approval Required ⏳',
          message: `${user?.name} created task "${form.title}". Please approve it.`,
          type: 'approval_request',
          link: `/tasks`,
          is_read: false,
          created_at: serverTimestamp()
        });
      }

      // Broadcast notification
      await addDoc(collection(db, 'notifications'), {
        user_id: 'all',
        title: 'New Task Assignment',
        message: `${user?.name} has assigned the ${project?.name || 'Project'} to ${assignee?.name || 'Unassigned'}`,
        type: 'task_created',
        is_read: false,
        created_at: serverTimestamp()
      });

      toast.success(isAutoApproved ? 'Task created!' : 'Task submitted for approval!');
      setShowCreateModal(false);
      setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
      
      if (isAutoApproved) {
        updateProjectProgress();
      }
    } catch (err) {
      console.error('Task creation error:', err);
      toast.error('Failed to create task. Check your permissions.');
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Task') {
      setActiveTask(event.active.data.current.task);
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === 'Task';
    const isOverATask = over.data.current?.type === 'Task';

    if (!isActiveATask) return;

    // Dropping a task over another task
    if (isActiveATask && isOverATask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (tasks[activeIndex].status !== tasks[overIndex].status) {
          tasks[activeIndex].status = tasks[overIndex].status;
          return arrayMove(tasks, activeIndex, overIndex - 1);
        }

        return arrayMove(tasks, activeIndex, overIndex);
      });
    }

    const isOverAColumn = over.data.current?.type === 'Column';

    // Dropping a task over a column
    if (isActiveATask && isOverAColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        tasks[activeIndex].status = overId as any;
        return arrayMove(tasks, activeIndex, activeIndex);
      });
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = (over.data.current?.task?.status || over.id) as string;
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { status: newStatus });

        // Broadcast notification
        await addDoc(collection(db, 'notifications'), {
          user_id: 'all',
          title: 'Task Updated',
          message: `${user?.name} moved task "${task.title}" to ${newStatus.replace('_', ' ')}`,
          type: 'task_status_change',
          is_read: false,
          created_at: serverTimestamp()
        });

        // Update project progress if status changed to/from 'done'
        if (newStatus === 'done' || task.status === 'done') {
          updateProjectProgress();
        }
      } catch (err) {
        console.error('Failed to update task status in Firestore', err);
      }
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center text-text-muted hover:text-primary transition-colors cursor-pointer w-fit" onClick={() => navigate('/projects')}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          <span className="text-sm font-bold uppercase tracking-wider">Back to Projects</span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-extrabold text-text-primary">{project?.name || 'Loading...'}</h2>
            <p className="text-text-muted mt-1">{project?.description}</p>
          </div>
          <div className="flex items-center space-x-3">
            {user?.role === 'admin' && (
              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-white/5 p-1.5 rounded-2xl border border-gray-100 dark:border-white/10 mr-2">
                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-2 mr-1">Status:</span>
                <select 
                  className="bg-transparent border-none text-xs font-black text-primary focus:ring-0 cursor-pointer uppercase tracking-tighter"
                  value={project?.status || 'todo'}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    try {
                      await updateDoc(doc(db, 'projects', id!), { status: newStatus });
                      setProject({ ...project, status: newStatus });
                      toast.success(`Project status: ${newStatus.toUpperCase()}`);
                    } catch (err) {
                      toast.error('Failed to update status');
                    }
                  }}
                >
                  <option value="todo">Todo</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="drop">Drop</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
            {user?.role === 'admin' && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-6 border-b border-border">
          {[
            { label: 'Kanban', icon: Layout },
            { label: 'Task List', icon: List },
            { label: 'Sprints', icon: Calendar },
            { label: 'Members', icon: Users },
          ].map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={`flex items-center py-3 px-1 border-b-2 transition-all font-bold text-sm ${
                activeTab === tab.label 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Assignee Filter */}
        {activeTab === 'Kanban' && (
          <div className="flex items-center space-x-4 py-4 px-1">
            <div className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Filter:</div>
            <div className="flex -space-x-2">
              <button
                onClick={() => setSelectedAssigneeId(null)}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all z-20 ${
                  selectedAssigneeId === null 
                  ? 'border-primary bg-primary text-white scale-110 shadow-lg' 
                  : 'border-white bg-gray-100 text-text-muted hover:bg-gray-200'
                }`}
              >
                ALL
              </button>
              {project?.members.map((mId: string) => {
                const emp = employees.find(e => e.id === mId);
                const isSelected = selectedAssigneeId === mId;
                return (
                  <button
                    key={mId}
                    onClick={() => setSelectedAssigneeId(isSelected ? null : mId)}
                    className={`relative transition-all ${isSelected ? 'z-30 scale-110' : 'z-10 hover:z-20 hover:scale-105'}`}
                  >
                    <Avatar 
                      name={emp?.name || '?'} 
                      url={emp?.avatar_url} 
                      size="md" 
                      className={`ring-2 ${isSelected ? 'ring-primary shadow-xl' : 'ring-white dark:ring-slate-900 shadow-sm'}`}
                    />
                    {isSelected && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
            {selectedAssigneeId && (
              <span className="text-xs font-black text-primary animate-fade-in">
                Showing {employees.find(e => e.id === selectedAssigneeId)?.name}'s tasks
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-x-auto pb-4 scrollbar-hide">
        {activeTab === 'Kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <div className="flex space-x-6 min-h-[500px]">
              {COLUMNS.map((col) => {
                const columnTasks = tasks.filter(t => {
                  const statusMatch = t.status === col.id;
                  const assigneeMatch = !selectedAssigneeId || t.assigned_to === selectedAssigneeId;
                  return statusMatch && assigneeMatch;
                });
                
                return (
                  <KanbanColumn 
                    key={col.id} 
                    id={col.id} 
                    title={col.title}
                    count={columnTasks.length}
                  >
                    <SortableContext 
                      items={columnTasks.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {columnTasks.map((task) => (
                        <KanbanTask key={task.id} task={task} />
                      ))}
                    </SortableContext>
                  </KanbanColumn>
                );
              })}
            </div>

            <DragOverlay>
              {activeTask ? <KanbanTask task={activeTask} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        ) : activeTab === 'Members' ? (
          <div className="glass p-10 rounded-[40px] border-none shadow-sm max-w-4xl">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-2xl font-black text-text-primary">Project Members</h3>
                <p className="text-sm text-text-muted">Manage who has access to this project</p>
              </div>
              {user?.role === 'admin' && (
                <div className="flex items-center space-x-4">
                  <select 
                    className="input h-11 px-4 bg-gray-50 border-none shadow-sm text-sm font-bold"
                    onChange={async (e) => {
                      const memberId = e.target.value;
                      if (!memberId || project.members.includes(memberId)) return;
                      try {
                        const newMembers = [...project.members, memberId];
                        await updateDoc(doc(db, 'projects', id!), { members: newMembers });
                        setProject({ ...project, members: newMembers });
                        toast.success('Member added!');
                      } catch (err) {
                        toast.error('Failed to add member');
                      }
                    }}
                  >
                    <option value="">Add member...</option>
                    {employees.filter(emp => !project.members.includes(emp.id)).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {project.members.map((mId: string) => {
                const emp = employees.find(e => e.id === mId);
                return (
                  <div key={mId} className="flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10">
                    <div className="flex items-center space-x-4">
                      <Avatar name={emp?.name || 'User'} size="md" />
                      <div>
                        <p className="text-sm font-black text-text-primary">{emp?.name || 'Unknown'}</p>
                        <p className="text-xs text-text-muted font-bold capitalize">{emp?.role || 'Employee'}</p>
                      </div>
                    </div>
                    {user?.role === 'admin' && project.created_by !== mId && (
                      <button 
                        onClick={async () => {
                          try {
                            const newMembers = project.members.filter((id: string) => id !== mId);
                            await updateDoc(doc(db, 'projects', id!), { members: newMembers });
                            setProject({ ...project, members: newMembers });
                            toast.success('Member removed');
                          } catch (err) {
                            toast.error('Failed to remove member');
                          }
                        }}
                        className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'Task List' ? (
          <div className="glass rounded-[40px] shadow-sm bg-white/40 dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/20 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                  <th className="px-8 py-6">Task Identity</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6">Priority</th>
                  <th className="px-8 py-6">Assignee</th>
                  <th className="px-8 py-6">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.filter(t => !selectedAssigneeId || t.assigned_to === selectedAssigneeId).map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-white/10 hover:bg-white/60 dark:hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-text-primary group-hover:text-primary transition-colors">
                          {task.title}
                        </span>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {task.task_code}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <StatusBadge status={task.status} />
                    </td>
                    <td className="px-8 py-6">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3">
                        <Avatar name={task.assignee_name} size="xs" />
                        <span className="text-xs font-bold text-text-secondary">{task.assignee_name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-xs font-bold text-text-muted">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'Sprints' ? (
          <div className="flex items-center justify-center py-20 text-text-muted italic font-medium">
            Sprints view coming soon...
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-text-muted italic font-medium">
            {activeTab} view coming soon...
          </div>
        )}
      </div>
      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-[40px] p-10 shadow-2xl animate-scale-up">
            <h2 className="text-3xl font-black text-text-primary mb-8">Allot New Task</h2>
            
            <form onSubmit={handleCreateTask} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Task Title</label>
                <input 
                  type="text" required
                  placeholder="e.g., Design Landing Page"
                  className="w-full h-14 px-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Assign Employee</label>
                <select 
                  required
                  className="w-full h-14 px-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none"
                  value={form.assigned_to}
                  onChange={(e) => setForm({...form, assigned_to: e.target.value})}
                >
                  <option value="">Select an employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Priority</label>
                  <select 
                    className="w-full h-14 px-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all"
                    value={form.priority}
                    onChange={(e) => setForm({...form, priority: e.target.value as any})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Due Date</label>
                  <input 
                    type="date"
                    className="w-full h-14 px-6 bg-gray-50 rounded-2xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all"
                    value={form.due_date}
                    onChange={(e) => setForm({...form, due_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-6">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-text-muted uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
