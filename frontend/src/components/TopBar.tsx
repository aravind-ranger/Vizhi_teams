import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Bell, Menu, Search, User, Settings, LogOut, Clock as ClockIcon, Power, Zap, Home, MapPin, Building, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { useAttendance } from '../hooks/useAttendance';
import api from '../services/api';
import Avatar from './Avatar';

interface TopBarProps {
  onFocusMode: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onFocusMode }) => {
  const [time, setTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { attendance, checkIn, checkOut, isBlocked } = useAttendance();
  
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isCheckoutConfirmed, setIsCheckoutConfirmed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read');
    }
  };

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path) return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <>
      <header className="sticky top-0 h-[70px] glass z-20 flex items-center justify-between px-8 mx-6 my-2 rounded-2xl transition-all duration-300">
        <div className="flex items-center">
          <button className="lg:hidden mr-4 p-2 hover:bg-gray-100 rounded-lg">
            <Menu className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">{getPageTitle()}</h1>
        </div>

        <div className="flex items-center space-x-6">
          {/* Attendance Widget */}
          <div className="flex items-center space-x-3 bg-gray-100/50 p-1 rounded-xl">
            {!attendance?.check_in ? (
              <button 
                onClick={() => setShowCheckInModal(true)}
                className="flex items-center px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                <Power className="w-3 h-3 mr-2" />
                Check In
              </button>
            ) : !attendance?.check_out ? (
              <button 
                onClick={() => {
                  if (isCheckoutConfirmed) {
                    checkOut();
                    setIsCheckoutConfirmed(false);
                  } else {
                    setShowCheckoutModal(true);
                  }
                }}
                className={`flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-all ${isCheckoutConfirmed ? 'bg-danger text-white scale-105 shadow-lg' : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'}`}
              >
                <ClockIcon className="w-3 h-3 mr-2" />
                {isCheckoutConfirmed ? 'Confirm Check Out' : 'Check Out'}
              </button>
            ) : (
              <div className="px-4 py-2 text-[10px] font-bold text-success uppercase tracking-wider">
                Work Completed 👏
              </div>
            )}
            
            <button 
              onClick={onFocusMode}
              className="flex items-center px-3 py-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
              title="Start Focus Session"
            >
              <Zap className="w-4 h-4 fill-current" />
            </button>
            
            <div className="hidden md:flex items-center text-text-secondary font-medium px-3 border-l border-gray-200">
              <span className="text-sm font-mono">{format(time, 'HH:mm:ss')}</span>
            </div>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-text-secondary hover:bg-gray-100 rounded-full relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.is_read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full border-2 border-white"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-modal border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center">
                  <span className="font-bold">Notifications</span>
                  <button onClick={markAllRead} className="text-xs text-primary font-medium hover:underline">Mark all as read</button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-xs font-medium">No notifications yet</div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-4 border-b border-border transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-gray-50'}`}
                        onClick={async () => {
                          if (!n.is_read) {
                            await api.patch(`/notifications/${n.id}/read`);
                            fetchNotifications();
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <p className={`text-sm font-medium ${!n.is_read ? 'text-text-primary' : 'text-text-secondary'}`}>{n.title}</p>
                          {!n.is_read && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                        </div>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-text-muted mt-2 font-bold uppercase tracking-widest">{format(new Date(n.created_at), 'h:mm a')}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 text-center border-t border-border">
                  <button className="text-sm text-text-muted hover:text-primary font-medium">View all</button>
                </div>
              </div>
            )}
          </div>

          {/* User Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1 pl-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-text-primary leading-tight">{user?.name}</p>
                <p className="text-[10px] text-text-muted leading-tight">{user?.role}</p>
              </div>
              <Avatar name={user?.name || ''} url={user?.avatar_url} size="sm" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-modal border border-border py-1 overflow-hidden">
                <button className="w-full flex items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-gray-100 transition-colors">
                  <User className="w-4 h-4 mr-3" />
                  Profile
                </button>
                <button className="w-full flex items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-gray-100 transition-colors">
                  <Settings className="w-4 h-4 mr-3" />
                  Change Password
                </button>
                <hr className="my-1 border-border" />
                <button 
                  onClick={logout}
                  className="w-full flex items-center px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Check-in Location Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm" onClick={() => setShowCheckInModal(false)} />
          <div className="relative bg-white w-full max-w-md p-10 rounded-[40px] shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black text-text-primary mb-2 text-center">Check-in Location</h3>
            <p className="text-text-muted text-center mb-8 font-medium">Where are you working from today?</p>
            
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'office', label: 'In Office', icon: Building, color: 'text-primary', bg: 'bg-primary/10' },
                { id: 'wfh', label: 'Work from Home', icon: Home, color: 'text-success', bg: 'bg-success/10' },
                { id: 'onsite', label: 'Onsite', icon: MapPin, color: 'text-warning', bg: 'bg-warning/10' },
              ].map((loc) => (
                <button
                  key={loc.id}
                  onClick={async () => {
                    await checkIn(loc.id);
                    setShowCheckInModal(false);
                  }}
                  className="flex items-center space-x-6 p-6 rounded-3xl border-2 border-transparent hover:border-primary/20 hover:bg-gray-50 transition-all group"
                >
                  <div className={`p-4 rounded-2xl ${loc.bg} group-hover:scale-110 transition-transform`}>
                    <loc.icon className={`w-8 h-8 ${loc.color}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black text-text-primary">{loc.label}</p>
                    <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Select this option</p>
                  </div>
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setShowCheckInModal(false)}
              className="w-full mt-8 h-14 text-text-muted font-black uppercase tracking-widest hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-text-primary/40 backdrop-blur-sm" onClick={() => setShowCheckoutModal(false)} />
          <div className="relative bg-white w-full max-w-sm p-10 rounded-[40px] shadow-2xl animate-scale-up text-center">
            <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-danger" />
            </div>
            <h3 className="text-2xl font-black text-text-primary mb-3">Finish for today?</h3>
            <p className="text-text-muted mb-8 font-medium">Are you sure you want to check out? You will need to press the button again to confirm.</p>
            
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => {
                  setIsCheckoutConfirmed(true);
                  setShowCheckoutModal(false);
                  toast.success('Confirmed. Press the checkout button once more to finish.');
                }}
                className="w-full h-14 bg-danger text-white font-black rounded-2xl shadow-xl shadow-danger/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Yes, I'm sure
              </button>
              <button
                onClick={() => {
                  setIsCheckoutConfirmed(false);
                  setShowCheckoutModal(false);
                }}
                className="w-full h-14 text-text-muted font-black uppercase tracking-widest hover:text-text-primary transition-colors"
              >
                No, Keep Working
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
