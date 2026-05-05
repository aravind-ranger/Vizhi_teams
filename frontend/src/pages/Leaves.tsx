import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, CheckCircle2, Clock, 
  XCircle, AlertCircle, ChevronRight, FileText, Check, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { db } from '../firebase';
import { 
  collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import ProgressBar from '../components/ProgressBar';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';

interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: any;
}

const Leaves: React.FC = () => {
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>(user?.role === 'admin' ? 'all' : 'my');
  useTitle('Leaves');

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('leave_form_backup');
    return saved ? JSON.parse(saved) : {
      leave_type: 'Sick',
      from_date: '',
      to_date: '',
      reason: ''
    };
  });

  // Backup form to localStorage
  useEffect(() => {
    localStorage.setItem('leave_form_backup', JSON.stringify(form));
  }, [form]);

  const balances = [
    { type: 'Sick', used: 2, total: 10, color: 'bg-red-500' },
    { type: 'Casual', used: 3, total: 12, color: 'bg-amber-500' },
    { type: 'Earned', used: 5, total: 15, color: 'bg-green-500' },
  ];

  const formatDate = (dateInput: any, formatStr: string) => {
    if (!dateInput) return 'N/A';
    try {
      const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, formatStr);
    } catch (err) {
      return 'Error Date';
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'leaves'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leavesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveRequest[];
      setLeaves(leavesData);
      setIsLoading(false);
    }, (err) => {
      console.error('Leaves listener error:', err);
      toast.error('Failed to load leaves');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'leaves'), {
        ...form,
        user_id: user?.id,
        employee_name: user?.name,
        status: 'pending',
        created_at: serverTimestamp()
      });
      toast.success('Leave application submitted!');
      setShowApplyModal(false);
      setForm({ leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
      localStorage.removeItem('leave_form_backup');
    } catch (err) {
      console.error('Submit leave error:', err);
      toast.error('Failed to submit application');
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const leaveRef = doc(db, 'leaves', id);
      await updateDoc(leaveRef, { status });
      toast.success(`Leave request ${status}`);
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Failed to update status');
    }
  };

  const statusColors = {
    pending: 'bg-amber-50 text-amber-600',
    approved: 'bg-green-50 text-green-600',
    rejected: 'bg-red-50 text-red-600',
  };

  const filteredLeaves = activeTab === 'my' 
    ? leaves.filter(l => l.user_id === user?.id)
    : leaves;

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Leaves</h2>
          <p className="text-sm text-text-muted">Manage time off and approvals</p>
        </div>
        <button 
          onClick={() => setShowApplyModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Apply for Leave
        </button>
      </div>

      {/* Role Tabs */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'my' ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            My Leaves
          </button>
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            Team Requests
          </button>
        </div>
      )}

      {/* Balance Cards (Only for 'my' tab) */}
      {activeTab === 'my' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {balances.map(b => (
            <div key={b.type} className="card glass p-6 border-none shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-text-secondary">{b.type} Leave</h3>
                <span className="text-sm font-bold">{b.used} / {b.total} Days</span>
              </div>
              <ProgressBar progress={(b.used / b.total) * 100} color={b.color} />
              <p className="text-xs text-text-muted mt-4 font-medium">
                Remaining: <span className="text-text-primary font-bold">{b.total - b.used} days</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* History Table */}
      <div className="card glass overflow-hidden border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/20 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {activeTab === 'all' && <th className="px-6 py-4">Employee</th>}
                <th className="px-6 py-4">Leave Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">No leave requests found</td>
                </tr>
              ) : filteredLeaves.map(leave => (
                <tr key={leave.id} className="border-b border-white/10 hover:bg-white/50 transition-colors">
                  {activeTab === 'all' && (
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Avatar name={leave.employee_name || ''} size="xs" className="mr-3" />
                        <span className="text-sm font-bold">{leave.employee_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 font-bold text-sm">{leave.leave_type}</td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {formatDate(leave.from_date, 'MMM d')} - {formatDate(leave.to_date, 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColors[leave.status]}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {activeTab === 'all' && leave.status === 'pending' ? (
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => updateStatus(leave.id, 'approved')}
                          className="p-2 bg-success/10 text-success rounded-lg hover:bg-success hover:text-white transition-all"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => updateStatus(leave.id, 'rejected')}
                          className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger hover:text-white transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button className="text-text-muted hover:text-primary">
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-modal w-full max-w-lg shadow-modal animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-xl font-bold">Apply for Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="text-text-muted hover:text-text-primary">&times;</button>
            </div>
            <form onSubmit={handleApply} className="p-6 space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-text-secondary">Leave Type</label>
                <div className="grid grid-cols-3 gap-4">
                  {['Sick', 'Casual', 'Earned'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({...form, leave_type: t})}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        form.leave_type === t ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-bold">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">From Date</label>
                  <input 
                    type="date" required className="input"
                    value={form.from_date} onChange={e => setForm({...form, from_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">To Date</label>
                  <input 
                    type="date" required className="input"
                    value={form.to_date} onChange={e => setForm({...form, to_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary">Reason</label>
                <textarea 
                  required className="input min-h-[100px] py-3"
                  value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowApplyModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaves;
