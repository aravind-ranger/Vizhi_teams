import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Users,
  Calendar,
  FileText,
  LayoutDashboard,
  Clock,
  Briefcase,
  FastForward,
  MessageSquare,
  PieChart,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Video,
  Settings,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { useSidebarStore } from "../store/useSidebarStore";
import { APP_VERSION } from "../config/version";
import RoleBadge from "./RoleBadge";
import Avatar from "./Avatar";

const Sidebar: React.FC = () => {
  const { isCollapsed, setIsCollapsed } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navSections = [
    {
      title: "Main Menu",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          path: "/dashboard",
          roles: ["admin", "manager", "employee"],
        },
      ],
    },
    {
      title: "People & HR",
      items: [
        {
          label: "Team Directory",
          icon: Users,
          path: "/employees",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "Attendance",
          icon: Clock,
          path: "/attendance",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "Leaves",
          icon: FileText,
          path: "/leaves",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "Calendar",
          icon: Calendar,
          path: "/calendar",
          roles: ["admin", "manager", "employee"],
        },
      ],
    },
    {
      title: "Execution",
      items: [
        {
          label: "Projects",
          icon: Briefcase,
          path: "/projects",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "All Tasks",
          icon: LayoutDashboard,
          path: "/tasks",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "Sprints",
          icon: FastForward,
          path: "/sprints",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "Meets",
          icon: Video,
          path: "/meets",
          roles: ["admin", "manager", "employee"],
        },
        {
          label: "Daily Scrum",
          icon: MessageSquare,
          path: "/daily-scrum",
          roles: ["admin", "manager", "employee"],
        },
      ],
    },
    {
      title: "Analytics",
      items: [
        {
          label: "Reports",
          icon: PieChart,
          path: "/reports",
          roles: ["admin", "manager"],
        },
        {
          label: "Admin Logs",
          icon: FileText,
          path: "/admin-logs",
          roles: ["admin"],
        },
        {
          label: "Late Check-In Requests",
          icon: ClipboardList,
          path: "/late-checkin-requests",
          roles: ["admin"],
        },
      ],
    },
  ];

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        (item.roles || []).includes(user?.role || ""),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-gray-200 dark:border-white/5 transition-all duration-500 ease-in-out z-30 flex flex-col shadow-2xl ${isCollapsed ? "w-20" : "w-[280px]"}`}
    >
      {/* Brand Header */}
      <div className="h-24 flex items-center px-6 border-b border-gray-100 dark:border-white/5 relative">
        <div
          className={`flex items-center space-x-3 ${isCollapsed ? "justify-center w-full" : ""}`}
        >
          {/* Logo container: Always black in light mode, primary/10 in dark mode */}
          <div className="w-10 h-10 bg-black dark:bg-primary/20 rounded-xl flex items-center justify-center p-2 shadow-lg transition-colors overflow-hidden">
            <img
              src="/Vizhi_Logo.png"
              alt="Vizhi"
              className="w-full h-full object-contain brightness-0 invert"
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-black text-lg text-slate-900 dark:text-white leading-none tracking-tight">
                VIZHI
              </span>
              <span className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase mt-0.5">
                Teams
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto py-8 px-4 space-y-10 scrollbar-hide">
        {filteredSections.map((section, idx) => (
          <div key={idx} className="space-y-3">
            {!isCollapsed && (
              <h3 className="px-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-60">
                {section.title}
              </h3>
            )}
            <div className="space-y-1.5">
              {section.items.map((item, i) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={i}
                    to={item.path!}
                    className={`
                      group relative flex items-center px-4 py-3 rounded-2xl transition-all duration-300 outline-none focus:outline-none
                      ${
                        isActive
                          ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]"
                          : "text-text-secondary hover:bg-primary/5 hover:text-primary"
                      }
                    `}
                  >
                    <item.icon
                      className={`
                        ${isCollapsed ? "mx-auto" : "mr-3.5"} 
                        w-5 h-5 flex-shrink-0 transition-transform duration-300
                        ${!isActive && "group-hover:scale-110 group-hover:rotate-3"}
                      `}
                    />
                    {!isCollapsed && (
                      <span className="font-bold text-sm tracking-tight">
                        {item.label}
                      </span>
                    )}

                    {/* Tooltip for collapsed mode */}
                    {isCollapsed && (
                      <div className="absolute left-20 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl z-50">
                        {item.label}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Professional Footer */}
      <div className="p-4 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
        {/* Theme Switcher Toggle */}
        <div
          className={`mb-4 flex items-center bg-white dark:bg-slate-800 rounded-xl p-1 shadow-inner border border-gray-100 dark:border-white/5 ${isCollapsed ? "justify-center" : "justify-between"}`}
        >
          {!isCollapsed ? (
            <>
              <button
                onClick={() => setTheme("light")}
                className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg transition-all ${theme === "light" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">Light</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-lg transition-all ${theme === "dark" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text-secondary"}`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">Dark</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-primary hover:bg-primary/5 transition-all"
            >
              {theme === "light" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5"}`}
        >
          <div className="flex items-center min-w-0">
            <Avatar
              name={user?.name || ""}
              url={user?.avatar_url}
              size={isCollapsed ? "sm" : "sm"}
              className="ring-2 ring-primary/10"
            />
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-xs font-black text-text-primary truncate">
                  {user?.name}
                </p>
                <div className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">
                    Online
                  </span>
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="ml-auto p-2 text-text-muted hover:text-danger hover:bg-danger/5 rounded-xl transition-all group"
              title="Logout"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center">
          <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-[0.3em]">
            v{APP_VERSION}
          </p>
        </div>
      </div>

      {/* Collapse Trigger - Refined */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-10 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-all z-50 border-2 border-white dark:border-slate-900"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </div>
  );
};

export default Sidebar;
