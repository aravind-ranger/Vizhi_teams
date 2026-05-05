import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, CheckCircle2, AlertCircle, 
  ArrowRight, Timer, MapPin, Zap, UserCheck
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useAttendance } from '../hooks/useAttendance';
import { useTitle } from '../hooks/useTitle';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import ProgressBar from '../components/ProgressBar';

const Attendance: React.FC = () => {
  const { user } = useAuthStore();
  const { attendance, checkIn, checkOut } = useAttendance();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useTitle('Attendance');

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user?.id) return;
    try {
      const q = query(
        collection(db, 'attendance'),
        where('user_id', '==', user.id),
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => {
        const item = doc.data();
        return {
          id: doc.id,
          date: item.created_at?.toDate ? item.created_at.toDate().toISOString() : item.check_in,
          ...item
        };
      });
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">Attendance Center</h2>
          <p className="text-text-muted mt-1 font-medium">Verify your shift logs and daily presence</p>
        </div>
        <div className="glass px-6 py-3 rounded-2xl flex items-center space-x-3 border-none shadow-sm">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-sm font-black text-text-secondary uppercase tracking-widest">{format(new Date(), 'MMMM yyyy')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Real-time Widget */}
        <div className="xl:col-span-1 space-y-8">
          <div className="glass p-10 rounded-[40px] border-none shadow-sm relative overflow-hidden bg-primary text-white">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Timer className="w-32 h-32 rotate-12" />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-xl font-black mb-10">Shift Pulse</h3>
              
              {!attendance?.check_in ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Zap className="w-10 h-10 text-white fill-current" />
                  </div>
                  <h4 className="text-2xl font-black mb-8">Start your shift?</h4>
                  <p className="text-sm font-bold text-white/60 uppercase tracking-[0.2em] animate-pulse">Use the check-in button in the top bar</p>
                </div>
              ) : attendance.check_out ? (
                <div className="text-center py-10">
                   <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-6" />
                   <h4 className="text-2xl font-black">Shift Completed</h4>
                </div>
              ) : (
                <div className="space-y-10 text-center">
                  <div>
                    <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-2">Checked in at</p>
                    <p className="text-4xl font-black">{format(new Date(attendance.check_in), 'HH:mm a')}</p>
                  </div>
                  
                  <div className="w-full h-px bg-white/10" />
                  
                  <p className="text-sm font-bold text-white/60 uppercase tracking-[0.2em] animate-pulse">Checkout via top bar</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass p-8 rounded-[40px] border-none shadow-sm">
            <h3 className="text-xl font-black mb-8">Summary</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-text-muted">Presence this month</span>
                <span className="text-lg font-black text-primary">85%</span>
              </div>
              <ProgressBar progress={85} className="h-2 rounded-full" />
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Total Days</p>
                  <p className="text-xl font-black text-text-primary">18 / 22</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Avg. Hours</p>
                  <p className="text-xl font-black text-text-primary">8.4h</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar View */}
        <div className="xl:col-span-2">
          <div className="glass p-10 rounded-[40px] border-none shadow-sm h-full">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-text-primary tracking-tight">Shift Log</h3>
              <div className="flex items-center space-x-6 text-xs font-bold text-text-muted">
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-success mr-2" /> Present</div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-danger mr-2" /> Absent</div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-warning mr-2" /> Leave</div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 px-4">
              <div className="min-w-[700px] grid grid-cols-7 gap-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">{d}</div>
                ))}
                {days.map((day, i) => {
                const dayLog = history.find(h => isSameDay(new Date(h.date), day));
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div 
                    key={i} 
                    className={`aspect-square rounded-3xl flex flex-col items-center justify-center relative group transition-all cursor-pointer ${
                      isToday ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-105 z-10' : 
                      dayLog ? 'bg-success/5 hover:bg-success/10' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-sm font-black ${isToday ? 'text-white' : 'text-text-primary'}`}>{format(day, 'd')}</span>
                    {dayLog && !isToday && <div className="absolute bottom-3 w-1.5 h-1.5 rounded-full bg-success" />}
                  </div>
                );
              })}
              </div>
            </div>
            
            <div className="mt-12 pt-10 border-t border-gray-100">
              <h4 className="text-lg font-black text-text-primary mb-6">Recent Activity</h4>
              <div className="space-y-4">
                {isLoading ? [1, 2].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />) :
                  history.slice(0, 5).map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                      <div className="flex items-center space-x-6">
                        <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                          <UserCheck className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-text-primary">{format(new Date(log.date), 'EEEE, MMMM d')}</p>
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Shift: 09:00 AM - 06:00 PM</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-text-primary">{log.duration_minutes ? (log.duration_minutes / 60).toFixed(1) + 'h' : '0.0h'}</p>
                        <p className="text-[10px] font-bold text-success uppercase tracking-widest mt-0.5">Verified</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
