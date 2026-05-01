import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Bell, Menu, Search, User, Settings, LogOut, Clock as ClockIcon, Power, Home, MapPin, Building, AlertTriangle, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { useAttendance } from '../hooks/useAttendance';
import { db } from '../firebase.ts';
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc, updateDoc, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
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
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { attendance, checkIn, checkOut, pause, resume, startOvertime, isBlocked, isLoading: isAttLoading } = useAttendance();
  
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isCheckoutConfirmed, setIsCheckoutConfirmed] = useState(false);
  const [hasNotifiedShiftEnd, setHasNotifiedShiftEnd] = useState(false);
  const [hasNotifiedScrum, setHasNotifiedScrum] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      // Shift end notification (8 hours)
      if (attendance?.check_in && !attendance.check_out && !hasNotifiedShiftEnd) {
        const checkInTime = new Date(attendance.check_in);
        const diffHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        if (diffHours >= 7.75 && diffHours < 8) { // 15 mins before
           toast('Your shift is ending in 15 minutes!', { icon: '⏰' });
           setHasNotifiedShiftEnd(true);
        }
        if (diffHours >= 8 && !hasNotifiedShiftEnd) {
           toast.success('Shift completed! You can now log overtime if needed.');
           setHasNotifiedShiftEnd(true);
        }
      }

      // Scrum reminder
      if (user && !hasNotifiedScrum) {
         checkScrum();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [attendance, hasNotifiedShiftEnd, user, hasNotifiedScrum]);

  const checkScrum = async () => {
    if (!user) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const q = query(
        collection(db, 'scrums'),
        where('user_id', '==', user.id),
        orderBy('created_at', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      let alreadySubmitted = false;
      if (!snap.empty) {
        const lastScrumDate = format(snap.docs[0].data().created_at.toDate(), 'yyyy-MM-dd');
        alreadySubmitted = lastScrumDate === today;
      }
      
      if (!alreadySubmitted) {
        toast('Don\'t forget to submit your Daily Scrum!', { icon: '📝', duration: 6000 });
      }
      setHasNotifiedScrum(true);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    
    const qPersonal = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.id)
    );

    const qBroadcast = query(
      collection(db, 'notifications'),
      where('user_id', '==', 'all')
    );

    const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
      const personalNotifs = snapshot.docs.map(doc => {
        const data = doc.data();
        let dateStr = new Date().toISOString();
        if (data.created_at?.toDate) {
          dateStr = data.created_at.toDate().toISOString();
        } else if (data.created_at) {
          dateStr = new Date(data.created_at).toISOString();
        }
        return {
          id: doc.id,
          ...data,
          created_at: dateStr
        };
      });
      setNotifications(prev => {
        const other = prev.filter(n => n.user_id !== user.id);
        return [...other, ...personalNotifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    });

    const unsubBroadcast = onSnapshot(qBroadcast, (snapshot) => {
      const broadcastNotifs = snapshot.docs.map(doc => {
        const data = doc.data();
        let dateStr = new Date().toISOString();
        if (data.created_at?.toDate) {
          dateStr = data.created_at.toDate().toISOString();
        } else if (data.created_at) {
          dateStr = new Date(data.created_at).toISOString();
        }
        return {
          id: doc.id,
          ...data,
          created_at: dateStr
        };
      });
      setNotifications(prev => {
        const other = prev.filter(n => n.user_id !== 'all');
        return [...other, ...broadcastNotifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    });

    return () => {
      unsubPersonal();
      unsubBroadcast();
    };
  }, [user?.id]);

  const markAllRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.is_read);
      if (unreadNotifs.length === 0) return;
      
      const batch = writeBatch(db);
      unreadNotifs.forEach(n => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { is_read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all as read', err);
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
          <button className="lg:hidden mr-4 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
            <Menu className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">{getPageTitle()}</h1>
        </div>

        <div className="flex items-center space-x-6">
          {/* Attendance Widget */}
          <div className="flex items-center space-x-3 bg-gray-100/50 dark:bg-white/5 p-1 rounded-xl">
            {isAttLoading ? (
              <div className="flex items-center px-4 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest animate-pulse">
                Syncing...
              </div>
            ) : !attendance?.check_in ? (
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
                  if (attendance.is_paused) {
                    toast.error('Please resume work before checking out');
                    return;
                  }
                  if (isCheckoutConfirmed) {
                    checkOut();
                    setIsCheckoutConfirmed(false);
                  } else {
                    setShowCheckoutModal(true);
                  }
                }}
                disabled={attendance.is_paused}
                className={`flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-all ${attendance.is_paused ? 'opacity-50 grayscale cursor-not-allowed' : ''} ${isCheckoutConfirmed ? 'bg-danger text-white scale-105 shadow-lg' : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'}`}
              >
                <ClockIcon className="w-3 h-3 mr-2" />
                {isCheckoutConfirmed ? 'Confirm Check Out' : 'Check Out'}
              </button>
            ) : (
              <div className="px-4 py-2 text-[10px] font-bold text-success uppercase tracking-wider">
                Work Completed 👏
              </div>
            )}

            {/* Overtime Button - Enabled after 8 hours or if checked out */}
            {attendance?.check_in && !attendance.is_overtime && (
              <button 
                onClick={startOvertime}
                disabled={(() => {
                  const checkInTime = new Date(attendance.check_in);
                  const diffHours = (new Date().getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
                  return diffHours < 8 && !attendance.check_out;
                })()}
                className={`flex items-center px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100 ${attendance.check_out ? 'bg-indigo-600' : 'bg-amber-500'}`}
              >
                <ClockIcon className="w-3 h-3 mr-2" />
                {attendance.check_out ? 'Extra Overtime' : 'Start Overtime'}
              </button>
            )}

            {/* End Overtime Button */}
            {attendance?.is_overtime && (
              <button 
                onClick={() => setShowCheckoutModal(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all animate-pulse"
              >
                <ClockIcon className="w-3 h-3 mr-2" />
                End Overtime
              </button>
            )}

            {/* Pause/Resume Actions */}
            {attendance?.check_in && !attendance?.check_out && (
              <div className="flex items-center space-x-1 border-l border-gray-200 ml-2 pl-2">
                {attendance.is_paused ? (
                  <button 
                    onClick={resume}
                    className="p-2 bg-success/10 text-success hover:bg-success hover:text-white rounded-lg transition-all"
                    title="Resume Work"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button 
                    onClick={pause}
                    className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-lg transition-all"
                    title="Take a Break"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                  </button>
                )}
              </div>
            )}
            
            <div className="hidden md:flex items-center text-text-secondary font-medium px-3 border-l border-gray-200 dark:border-white/10">
              <span className="text-sm font-mono">{format(time, 'HH:mm:ss')}</span>
            </div>
          </div>

          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-text-secondary hover:bg-gray-100 dark:hover:bg-white/10 rounded-full relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.is_read) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full border-2 border-white dark:border-[#0B1120]"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-glass rounded-xl shadow-modal border border-border dark:border-white/10 overflow-hidden">
                <div className="p-4 border-b border-border dark:border-white/10 flex justify-between items-center bg-white dark:bg-transparent">
                  <span className="font-bold text-text-primary">Notifications (Today)</span>
                  <button onClick={markAllRead} className="text-xs text-primary font-medium hover:underline">Mark all as read</button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {(() => {
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const todayNotifs = notifications.filter(n => format(new Date(n.created_at), 'yyyy-MM-dd') === today);
                    
                    if (todayNotifs.length === 0) {
                      return <div className="p-8 text-center text-text-muted text-xs font-medium">No notifications for today</div>;
                    }

                    return todayNotifs.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-4 border-b border-border transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-gray-50'}`}
                        onClick={async () => {
                          if (!n.is_read) {
                            try {
                              await updateDoc(doc(db, 'notifications', n.id), { is_read: true });
                            } catch (err) {
                              console.error('Failed to mark read', err);
                            }
                          }
                          if (n.link) {
                            window.open(n.link, '_blank');
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <p className={`text-sm font-medium ${!n.is_read ? 'text-text-primary' : 'text-text-secondary'}`}>{n.title}</p>
                          {!n.is_read && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                        </div>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">{n.message}</p>
                        {n.type === 'meet_request' && !n.is_read && (
                          <div className="mt-3 flex space-x-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(n.link, '_blank');
                                updateDoc(doc(db, 'notifications', n.id), { is_read: true });
                              }}
                              className="flex-1 py-2 bg-primary text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-sm hover:scale-105 transition-all"
                            >
                              Join Meeting
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateDoc(doc(db, 'notifications', n.id), { is_read: true });
                              }}
                              className="flex-1 py-2 bg-gray-100 text-text-muted text-[10px] font-black rounded-lg uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {n.link && n.type !== 'meet_request' && (
                          <div className="mt-3 py-2 px-4 bg-primary text-white text-[10px] font-black rounded-lg text-center uppercase tracking-widest shadow-sm shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                            View Details
                          </div>
                        )}
                        <p className="text-[10px] text-text-muted mt-2 font-bold uppercase tracking-widest">{format(new Date(n.created_at), 'h:mm a')}</p>
                      </div>
                    ));
                  })()}
                </div>
                <div className="p-3 text-center border-t border-border">
                  <button 
                    onClick={() => { setShowNotifications(false); setShowAllNotifs(true); }}
                    className="text-sm text-text-muted hover:text-primary font-medium"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1 pl-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-text-primary leading-tight">{user?.name}</p>
                <p className="text-[10px] text-text-muted leading-tight">{user?.role}</p>
              </div>
              <Avatar name={user?.name || ''} url={user?.avatar_url} size="sm" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-glass rounded-xl shadow-modal border border-border dark:border-white/10 py-1 overflow-hidden z-50">
                <div className="px-4 py-2">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">My Availability</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { id: 'available', label: 'Available', color: 'bg-success' },
                      { id: 'busy', label: 'Busy', color: 'bg-danger' },
                      { id: 'permission', label: 'Permission', color: 'bg-amber-500' },
                      { id: 'away', label: 'Away', color: 'bg-gray-400' },
                    ].map((status) => (
                      <button
                        key={status.id}
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'users', user?.id || ''), { availability_status: status.id });
                            
                            await addDoc(collection(db, 'notifications'), {
                              user_id: 'all',
                              title: 'Availability Update',
                              message: `${user?.name} is now ${status.label}`,
                              type: 'availability_change',
                              status: status.id,
                              is_read: false,
                              created_at: serverTimestamp()
                            });
                            
                            toast.success(`Status updated to ${status.label}`);
                            setShowUserMenu(false);
                          } catch (err) {
                            console.error('Failed to update status', err);
                          }
                        }}
                        className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold transition-all hover:bg-gray-50 ${user?.availability_status === status.id ? 'bg-primary/5 text-primary' : 'text-text-secondary'}`}
                      >
                        <div className={`w-2 h-2 rounded-full mr-3 ${status.color}`} />
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="my-1 border-border" />
                <button 
                  onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                  className="w-full flex items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-gray-100 transition-colors"
                >
                  <User className="w-4 h-4 mr-3" />
                  Profile
                </button>
                <button 
                  onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                  className="w-full flex items-center px-4 py-2.5 text-sm text-text-secondary hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-3" />
                  Change Password
                </button>
                <hr className="my-1 border-border" />
                <button 
                  onClick={logout}
                  className="w-full flex items-center px-4 py-2.5 text-sm text-danger hover:bg-danger/5 dark:hover:bg-danger/10 transition-colors"
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
          <div className="absolute inset-0 bg-text-primary/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckInModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-md p-10 rounded-[40px] shadow-2xl animate-scale-up">
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
          <div className="absolute inset-0 bg-text-primary/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckoutModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-sm p-10 rounded-[40px] shadow-2xl animate-scale-up text-center">
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

      {/* View All Notifications Modal */}
      {showAllNotifs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAllNotifs(false)} />
          <div className="relative bg-white dark:bg-[#0B1120] w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="p-8 border-b border-border dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-2xl font-black text-text-primary tracking-tighter">All Notifications</h3>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Full activity history</p>
              </div>
              <button 
                onClick={() => setShowAllNotifs(false)}
                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-white/10 rounded-2xl shadow-sm hover:text-danger transition-all active:scale-90 text-text-primary"
              >
                <AlertTriangle className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {(() => {
                const grouped: { [key: string]: any[] } = {};
                notifications.forEach(n => {
                  const date = format(new Date(n.created_at), 'yyyy-MM-dd');
                  if (!grouped[date]) grouped[date] = [];
                  grouped[date].push(n);
                });

                const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

                if (sortedDates.length === 0) {
                  return <div className="p-20 text-center text-text-muted font-bold">No history available</div>;
                }

                return sortedDates.map((date, idx) => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-[2px] flex-1 bg-slate-900 dark:bg-white/20" />
                      <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] whitespace-nowrap bg-slate-100 dark:bg-white/10 px-4 py-1.5 rounded-full">
                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                      </span>
                      <div className="h-[2px] flex-1 bg-slate-900 dark:bg-white/20" />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {grouped[date].map((n) => (
                        <div key={n.id} className={`p-6 rounded-[24px] border ${n.is_read ? 'bg-white dark:bg-white/5 border-border dark:border-white/5' : 'bg-primary/5 border-primary/20 shadow-sm shadow-primary/10'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-black text-text-primary tracking-tight">{n.title}</h4>
                            <span className="text-[10px] font-bold text-text-muted">{format(new Date(n.created_at), 'h:mm a')}</span>
                          </div>
                          <p className="text-sm text-text-secondary leading-relaxed">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
