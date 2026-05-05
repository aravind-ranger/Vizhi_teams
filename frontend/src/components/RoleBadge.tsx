import React from "react";
import type { Role } from "../types";

interface RoleBadgeProps {
  role: Role;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const config = {
    admin: {
      label: "Admin",
      color:
        "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300",
    },
    manager: {
      label: "Manager",
      color: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    },
    employee: {
      label: "Employee",
      color:
        "bg-gray-50 text-gray-600 dark:bg-white/10 dark:text-text-secondary",
    },
  };

  const { label, color } = config[role] || config.employee;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-badge text-[10px] font-bold uppercase tracking-wider ${color}`}
    >
      {label}
    </span>
  );
};

export default RoleBadge;
