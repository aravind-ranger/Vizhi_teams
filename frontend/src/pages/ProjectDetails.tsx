import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Plus, MoreHorizontal, Calendar, 
  List, Layout, Settings, Users 
} from 'lucide-react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import api from '../services/api';
import KanbanColumn from '../components/KanbanColumn';
import KanbanTask from '../components/KanbanTask';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  due_date: string;
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
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Kanban');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const fetchProjectData = async () => {
    setIsLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        api.get(`/projects`), // Simulating single project fetch since I only have list API for now
        api.get(`/tasks?projectId=${id}`)
      ]);
      const p = pRes.data.find((proj: any) => proj.id === id);
      setProject(p);
      setTasks(tRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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
    const newStatus = over.data.current?.task?.status || over.id;

    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status', err);
      fetchProjectData(); // Rollback
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
            <button className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary"><Settings className="w-5 h-5" /></button>
            <button className="btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </button>
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
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-4 scrollbar-hide">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex space-x-6 min-h-[500px]">
            {COLUMNS.map((col) => (
              <KanbanColumn 
                key={col.id} 
                id={col.id} 
                title={col.title}
                count={tasks.filter(t => t.status === col.id).length}
              >
                <SortableContext 
                  items={tasks.filter(t => t.status === col.id).map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tasks
                    .filter(t => t.status === col.id)
                    .map((task) => (
                      <KanbanTask key={task.id} task={task} />
                    ))}
                </SortableContext>
              </KanbanColumn>
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <KanbanTask task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default ProjectDetails;
