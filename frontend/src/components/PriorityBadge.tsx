import React from 'react';

type Priority = 'low' | 'medium' | 'high';

interface PriorityBadgeProps {
  priority: Priority;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const config = {
    low: { label: '↓ Low', color: 'bg-green-50 text-green-600' },
    medium: { label: '→ Medium', color: 'bg-amber-50 text-amber-600' },
    high: { label: '↑ High', color: 'bg-red-50 text-red-600' },
  };

  const { label, color } = config[priority] || config.medium;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-badge text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

export default PriorityBadge;
