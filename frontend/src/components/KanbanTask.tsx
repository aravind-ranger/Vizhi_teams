import React from 'react'; // Kanban Task Component
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, MessageSquare, Paperclip } from 'lucide-react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import Avatar from './Avatar';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'active' | 'completed' | 'planned' | 'pending' | 'paused_by_break';
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  due_date: string;
  is_approved?: boolean;
  is_paused_by_break?: boolean;
  active_session_id?: string | null;
  task_code?: string;
}

interface KanbanTaskProps {
  task: Task;
  isOverlay?: boolean;
}

const KanbanTask: React.FC<KanbanTaskProps> = ({ task, isOverlay }) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="card p-4 h-32 border-2 border-primary/20 opacity-30 bg-primary/5"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`card p-4 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing border-transparent hover:border-primary/20 group ${
        isOverlay ? 'shadow-2xl border-primary/30 ring-4 ring-primary/5' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <PriorityBadge priority={task.priority} />
        <span className="text-[10px] font-bold text-text-muted flex items-center">
          <Calendar className="w-3 h-3 mr-1" />
          {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
        </span>
      </div>

      <h4 className="font-bold text-text-primary text-sm group-hover:text-primary transition-colors mb-1 line-clamp-2">
        {task.title}
      </h4>
      {/* Task ID removed as per request */}

      {task.is_paused_by_break && (
        <div className="mb-3 py-1.5 px-3 bg-amber-50 text-amber-600 text-[9px] font-black rounded-lg text-center uppercase tracking-widest border border-amber-200 animate-pulse">
          ⏸ Timer Frozen
        </div>
      )}

      {!task.is_approved && (
        <div className="mb-3 py-1.5 px-3 bg-red-50 text-red-600 text-[9px] font-black rounded-lg text-center uppercase tracking-widest border border-red-100">
          ⏳ Awaiting Approval
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-3">
          {/* Comments and links removed as per request */}
        </div>
        <Avatar name={task.assignee_name || 'Unassigned'} size="xs" />
      </div>
    </div>
  );
};

export default KanbanTask;
