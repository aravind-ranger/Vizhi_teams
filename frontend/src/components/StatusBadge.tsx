import React from 'react';

type Status = 'todo' | 'in_progress' | 'review' | 'done' | 'active' | 'completed' | 'planned' | 'pending' | 'paused_by_break';

interface StatusBadgeProps {
  status: Status;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config: Record<Status, { label: string; color: string }> = {
    todo: { label: 'To Do', color: 'bg-gray-100 text-gray-600 dot-gray-400' },
    in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-600 dot-blue-400' },
    review: { label: 'Review', color: 'bg-amber-50 text-amber-600 dot-amber-400' },
    done: { label: 'Done', color: 'bg-green-50 text-green-600 dot-green-400' },
    // Sprint Statuses
    planned: { label: 'Planned', color: 'bg-gray-100 text-gray-600 dot-gray-400' },
    active: { label: 'Active', color: 'bg-blue-50 text-blue-600 dot-blue-400' },
    completed: { label: 'Completed', color: 'bg-green-50 text-green-600 dot-green-400' },
    pending: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-600 dot-amber-400' },
    paused_by_break: { label: 'Paused (Break)', color: 'bg-red-50 text-red-600 dot-red-400' },
  };

  const { label, color } = config[status] || config.todo;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-badge text-xs font-medium ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${color.replace('text-', 'bg-').split(' ')[2].replace('dot-', 'bg-')}`}></span>
      {label}
    </span>
  );
};

export default StatusBadge;
