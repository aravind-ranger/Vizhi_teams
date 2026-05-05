import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, FileText, LayoutDashboard, 
  Briefcase, FastForward, MessageSquare, PieChart,
  ChevronLeft, ChevronRight, LogOut, Settings
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import RoleBadge from './RoleBadge';
import Avatar from './Avatar';

const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'manager', 'employee'] },
      ]
    },
    {
      title: 'HR & PEOPLE',
      items: [
        { label: 'Team Directory', icon: Users, path: '/employees', roles: ['admin', 'manager', 'employee'] },
        { label: 'Attendance', icon: Calendar, path: '/attendance', roles: ['admin', 'manager', 'employee'] },
        { label: 'Leaves', icon: FileText, path: '/leaves', roles: ['admin', 'manager', 'employee'] },
      ]
    },
    {
      title: 'PROJECTS',
      items: [
        { label: 'Projects', icon: Briefcase, path: '/projects', roles: ['admin', 'manager', 'employee'] },
        { label: 'All Tasks', icon: LayoutDashboard, path: '/tasks', roles: ['admin', 'manager', 'employee'] },
        { label: 'Sprints', icon: FastForward, path: '/sprints', roles: ['admin', 'manager', 'employee'] },
        { label: 'Daily Scrum', icon: MessageSquare, path: '/daily-scrum', roles: ['admin', 'manager', 'employee'] },
      ]
    },
    {
      title: 'TOOLS',
      items: [
        { label: 'Reports', icon: PieChart, path: '/reports', roles: ['admin', 'manager', 'employee'] },
        { label: 'Admin Logs', icon: FileText, path: '/admin-logs', roles: ['admin'] },
      ]
    }
  ];

  const filteredSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.roles.includes(user?.role || ''))
  })).filter(section => section.items.length > 0);

  return (
    <div className={`fixed inset-y-0 left-0 z-30 h-screen bg-white border-r border-border transition-transform duration-300 ease-in-out flex flex-col ${isCollapsed ? 'w-16' : 'w-[240px]'} ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:top-auto lg:left-auto`}>
      {/* Logo */}
      <div className="h-[60px] flex items-center px-4 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold">V</span>
        </div>
        {!isCollapsed && (
          <span className="ml-3 font-bold text-lg text-text-primary whitespace-nowrap">Vizhi Teams</span>
        )}
        <button
          onClick={onClose}
          className="ml-auto p-2 text-text-secondary hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide">
        {filteredSections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            {!isCollapsed && (
              <h3 className="px-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item, i) => (
                <NavLink
                  key={i}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center px-3 py-2.5 rounded-lg transition-all duration-200
                    ${isActive 
                      ? 'bg-primary text-white shadow-md' 
                      : 'text-text-secondary hover:bg-gray-100'}
                  `}
                >
                  <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-3'} w-5 h-5 flex-shrink-0`} />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-gray-50/50">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center">
            <Avatar name={user?.name || ''} url={user?.avatar_url} size="sm" />
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-bold text-text-primary truncate">{user?.name}</p>
                <RoleBadge role={user?.role || 'employee'} />
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button 
              onClick={handleLogout}
              className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-[74px] w-6 h-6 bg-white border border-border rounded-full items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-40"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
