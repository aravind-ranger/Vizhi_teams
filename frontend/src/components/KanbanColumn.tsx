import React from 'react'; // Kanban Column Component
import { useDroppable } from '@dnd-kit/core';
import { Plus, MoreHorizontal } from 'lucide-react';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, count, children }) => {
  const { setNodeRef } = useDroppable({
    id,
    data: {
      type: 'Column',
    },
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex flex-col w-full sm:w-[320px] bg-gray-50/50 rounded-2xl p-4 border border-border/50 h-fit min-h-[400px]"
    >
      <div className="flex justify-between items-center mb-6 px-1">
        <div className="flex items-center space-x-3">
          <h3 className="font-bold text-text-primary">{title}</h3>
          <span className="bg-white border border-border px-2 py-0.5 rounded-full text-[10px] font-bold text-text-muted">
            {count}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button className="p-1 text-text-muted hover:bg-white hover:shadow-sm rounded transition-all">
            <Plus className="w-4 h-4" />
          </button>
          <button className="p-1 text-text-muted hover:bg-white hover:shadow-sm rounded transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        {children}
      </div>
    </div>
  );
};

export default KanbanColumn;
