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

const Sidebar: React.FC = () => {
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
        { label: 'Calendar', icon: Calendar, path: '/calendar', roles: ['admin', 'manager', 'employee'] },
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
    <div className={`fixed left-0 top-0 h-screen bg-white border-r border-border transition-all duration-300 ease-in-out z-30 flex flex-col ${isCollapsed ? 'w-20' : 'w-[280px]'}`}>
      <div className="h-[70px] flex items-center px-6 border-b border-border">
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
          <img src="/assets/logo.png" alt="Vizhi" className="w-full h-full object-contain" onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://ui-avatars.com/api/?name=V&background=000&color=fff';
          }} />
        </div>
        {!isCollapsed && (
          <span className="ml-3 font-bold text-lg text-text-primary whitespace-nowrap">Vizhi Teams</span>
        )}
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
          className="absolute -right-3 top-[74px] w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-40"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
