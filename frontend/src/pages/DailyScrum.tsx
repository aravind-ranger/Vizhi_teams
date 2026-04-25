import React, { useState } from 'react';
import { Send, Clock, User, Filter, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';

const DailyScrum: React.FC = () => {
  const { user } = useAuthStore();
  const [isSubmitted, setIsSubmitted] = useState(false);
  useTitle('Daily Scrum');
  const [form, setForm] = useState({
    yesterday: '',
    today: '',
    blockers: ''
  });

  const [history] = useState([
    { date: '2026-04-24', yesterday: 'Completed backend auth', today: 'Working on dashboard UI', blockers: 'None' },
    { date: '2026-04-23', yesterday: 'Setup database schema', today: 'Backend API implementation', blockers: 'Waiting for SMTP creds' },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
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

      {isSubmitted ? (
        <div className="bg-success/5 border border-success/20 rounded-2xl p-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h4 className="text-xl font-bold text-success mb-1">Status Submitted!</h4>
          <p className="text-text-secondary">Great job staying synchronized with the team. You can edit this until midnight.</p>
          <button 
            onClick={() => setIsSubmitted(false)}
            className="mt-6 text-sm font-bold text-primary hover:underline"
          >
            Edit your response
          </button>
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

      {/* History */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold flex items-center">
          <Clock className="w-5 h-5 mr-2 text-text-muted" />
          Recent Activity
        </h3>
        <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
          {history.map((item, i) => (
            <div key={i} className="relative pl-12">
              <div className="absolute left-0 top-1 w-10 h-10 bg-white border border-border rounded-full flex items-center justify-center z-10 shadow-sm">
                <CalendarIcon className="w-5 h-5 text-text-muted" />
              </div>
              <div className="card p-6">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-text-primary">{format(new Date(item.date), 'MMMM d, yyyy')}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Yesterday</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{item.yesterday}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Today</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{item.today}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Blockers</p>
                    <p className="text-sm font-medium text-danger">{item.blockers}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyScrum;
