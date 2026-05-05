import React from 'react';
import type { Role } from '../types';

interface RoleBadgeProps {
  role: Role;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const config = {
    admin: { label: 'Admin', color: 'bg-purple-50 text-purple-600' },
    manager: { label: 'Manager', color: 'bg-blue-50 text-blue-600' },
    employee: { label: 'Employee', color: 'bg-gray-50 text-gray-600' },
  };

  const { label, color } = config[role] || config.employee;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {label}
    </span>
  );
};

export default RoleBadge;
