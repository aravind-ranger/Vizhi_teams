import React, { useState, useEffect } from 'react';
import { Send, Clock, User, Filter, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';
import { db } from '../firebase.ts';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, where, limit } from 'firebase/firestore';

const DailyScrum: React.FC = () => {
  const { user } = useAuthStore();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submissionDate, setSubmissionDate] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  useTitle('Daily Scrum');
  const [form, setForm] = useState({
    yesterday: '',
    today: '',
    blockers: ''
  });

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 1. Initial check via localStorage for immediate feedback
    const lastSub = localStorage.getItem(`scrum_last_sub_${user?.id}`);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (lastSub === todayStr) {
      setIsSubmitted(true);
      setSubmissionDate('Earlier today'); // Will be updated by Firestore check
    }

    if (user?.role === 'admin') {
      fetchHistory(filterDate);
    }
    checkTodaySubmission();
  }, [user, filterDate]);

  const checkTodaySubmission = async () => {
    if (!user) return;
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const q = query(
        collection(db, 'scrums'),
        where('user_id', '==', user.id),
        where('created_at', '>=', startOfToday),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setSubmissionDate(format(data.created_at?.toDate() || new Date(), 'MMM d, yyyy h:mm a'));
        setIsSubmitted(true);
        // Sync localStorage
        localStorage.setItem(`scrum_last_sub_${user.id}`, format(new Date(), 'yyyy-MM-dd'));
      } else {
        setIsSubmitted(false);
        localStorage.removeItem(`scrum_last_sub_${user.id}`);
      }
    } catch (err) {
      console.error('Error checking scrum submission:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const fetchHistory = async (dateStr?: string) => {
    setIsLoading(true);
    try {
      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

      const q = query(
        collection(db, 'scrums'),
        where('created_at', '>=', start),
        where('created_at', '<=', end)
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().created_at?.toDate()?.toISOString() || new Date().toISOString()
      } as any)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitted) return; // Final safeguard
    try {
      await addDoc(collection(db, 'scrums'), {
        ...form,
        user_id: user?.id,
        user_name: user?.name,
        created_at: serverTimestamp()
      });
      
      const subTime = format(new Date(), 'MMM d, yyyy h:mm a');
      setSubmissionDate(subTime);
      setIsSubmitted(true);
      localStorage.setItem(`scrum_last_sub_${user?.id}`, format(new Date(), 'yyyy-MM-dd'));
      
      fetchHistory(filterDate);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Daily Scrum</h2>
          <p className="text-sm text-text-muted">Keep your team updated on your progress</p>
        </div>
        <div className="flex items-center text-text-secondary font-medium">
          <CalendarIcon className="w-4 h-4 mr-2" />
          {format(new Date(), 'EEEE, MMM d')}
        </div>
      </div>

      {isChecking ? (
        <div className="py-20 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Verifying status...</p>
        </div>
      ) : isSubmitted ? (
        <div className="bg-success/5 border border-success/20 rounded-2xl p-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h4 className="text-xl font-bold text-success mb-1">Status Submitted!</h4>
          <p className="text-text-secondary">Great job staying synchronized with the team.</p>
          <p className="text-xs font-bold text-success/60 uppercase tracking-widest mt-2">Submitted on {submissionDate}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-8 border-b border-border bg-gray-50/30">
            <h3 className="text-lg font-bold">Today's Status Update</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-text-secondary">1. What did you do yesterday?</label>
              <textarea 
                required
                className="input min-h-[120px] py-3 text-sm leading-relaxed"
                placeholder="List your accomplishments from the previous work day..."
                value={form.yesterday}
                onChange={e => setForm({...form, yesterday: e.target.value})}
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-bold text-text-secondary">2. What are you doing today?</label>
              <textarea 
                required
                className="input min-h-[120px] py-3 text-sm leading-relaxed"
                placeholder="Outline your goals and planned tasks for today..."
                value={form.today}
                onChange={e => setForm({...form, today: e.target.value})}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-text-secondary">3. Any blockers?</label>
              <textarea 
                className="input min-h-[100px] py-3 text-sm leading-relaxed"
                placeholder="Mention any issues or dependencies slowing you down..."
                value={form.blockers}
                onChange={e => setForm({...form, blockers: e.target.value})}
              />
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                className="btn-primary px-10 h-12 flex items-center"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Daily Scrum
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History - Visible to Admin Only */}
      {user?.role === 'admin' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center">
              <Clock className="w-5 h-5 mr-2 text-text-muted" />
              Recent Activity (Admin View)
            </h3>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-text-muted">Filter by:</span>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-white border border-border px-4 py-2 rounded-xl text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none"
              />
            </div>
          </div>
          <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
            {history.map((item, i) => (
              <div key={i} className="relative pl-12">
                <div className="absolute left-0 top-1 w-10 h-10 bg-white border border-border rounded-full flex items-center justify-center z-10 shadow-sm">
                  <Avatar name={item.user_name || 'User'} size="xs" />
                </div>
                <div className="card p-6 hover:shadow-lg transition-all border-l-4 border-l-primary">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-text-primary">{item.user_name}</span>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{format(new Date(item.date), 'EEEE, MMM d, yyyy')}</span>
                    </div>
                    {item.blockers && (
                      <div className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg uppercase tracking-widest animate-pulse border border-rose-100">
                        Blocker Detected
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2" />
                        Yesterday
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100">{item.yesterday}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                        Today
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed bg-primary/5 p-4 rounded-2xl border border-primary/10">{item.today}</p>
                    </div>
                  </div>
                  {item.blockers && (
                    <div className="mt-6 p-4 bg-rose-50/30 rounded-2xl border border-rose-100">
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Obstacles / Blockers</p>
                      <p className="text-sm font-medium text-rose-700">{item.blockers}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyScrum;
