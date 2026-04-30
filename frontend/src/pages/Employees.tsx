import React, { useState, useEffect } from 'react';
import {
  Search, Mail, Briefcase, MapPin,
  Link, Share2, MoreHorizontal, UserCheck,
  ExternalLink, Building, ShieldCheck, Plus, X, Edit as EditIcon, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase.ts';
import { collection, query, getDocs, orderBy, addDoc, doc, setDoc, serverTimestamp, deleteDoc, where } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';
import RoleBadge from '../components/RoleBadge';
import { useAuthStore } from '../store/useAuthStore';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  department: string;
  is_active: boolean;
  avatar_url: string;
  created_at: string;
}

const Employees: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '',
    email: '',
    role: 'employee' as const,
    department: '',
    password: ''
  });
  useTitle('Team Members');

  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const employeeData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(employeeData);

      // Fetch today's attendance to show presence dots
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const attRef = collection(db, 'attendance');
      const qAtt = query(attRef, where('created_at', '>=', todayStart));
      const attSnap = await getDocs(qAtt);
      const attMap: Record<string, boolean> = {};
      attSnap.docs.forEach(d => {
        attMap[d.data().user_id] = true;
      });
      setAttendanceMap(attMap);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Use the email provided or generate one if only name is given
      const loginEmail = newEmp.email.includes('@') ? newEmp.email : `${newEmp.name.replace(/\s+/g, '').toLowerCase()}@gmail.com`;
      const password = newEmp.password || `${newEmp.name.replace(/\s+/g, '').toLowerCase()}@123`;

      // Create user in Auth (this will log us in as them, so we need to be careful)
      // Actually, since I don't have secondary app setup easily here, I'll just tell the admin
      // that for now we add them to Firestore and they can login using the simplified flow.
      // BUT if I want it to really work, I should use the secondary app.

      // Let's just add to Firestore for now as "Pre-registered" and I'll explain.
      // Actually, I'll use a dummy ID for now or skip Auth creation if I can't do it cleanly.

      // Use a unique name for each secondary app instance to avoid collisions
      const appName = `secondary-${Date.now()}`;
      const secondaryApp = initializeApp(auth.app.options, appName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCred = await createUserWithEmailAndPassword(secondaryAuth, loginEmail, password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        name: newEmp.name,
        email: loginEmail,
        role: newEmp.role,
        department: newEmp.department,
        is_active: true,
        created_at: serverTimestamp(),
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmp.name)}&background=random`
      });

      await signOut(secondaryAuth);

      toast.success('Member created successfully!');
      setShowAddModal(false);
      fetchEmployees();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create member');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!employeeToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', employeeToDelete.id));
      toast.success(`User ${employeeToDelete.name} deleted successfully`);
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete user');
    }
  };

  const getTitle = (name: string) => {
    const nameMap: Record<string, string> = {
      'Aadhi': 'Founder',
      'Sathish': 'Co-Founder',
      'Abdul': 'CEO',
      'Aravind': 'CTO',
      'Guru Gokul': 'Intern',
      'Shreeram': 'Intern'
    };
    return nameMap[name] || 'Team Member';
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">Our People</h2>
          <p className="text-text-muted mt-1 font-medium">The heartbeat of Vizhi Teams</p>
        </div>
        <div className="flex items-center space-x-4">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-3 px-6 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Add Member</span>
            </button>
          )}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 pl-12 pr-4 input border-none shadow-sm font-medium"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-[420px] rounded-[40px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="group glass p-8 rounded-[40px] border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden"
            >
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-colors" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-8">
                  <Avatar name={employee.name} size="xl" url={employee.avatar_url} className="ring-4 ring-white dark:ring-white/10 shadow-xl" />
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === employee.id ? null : employee.id);
                      }}
                      className="p-2 hover:bg-white/50 rounded-2xl transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5 text-text-muted" />
                    </button>
                    {openMenuId === employee.id && user?.role === 'admin' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-glass rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => {
                            setEmployeeToDelete(employee);
                            setShowDeleteModal(true);
                            setOpenMenuId(null);
                          }}
                          className="w-full flex items-center px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-3" />
                          Delete User
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-xl font-black text-text-primary group-hover:text-primary transition-colors">
                      {employee.name}
                    </h3>
                    <div className={`w-2 h-2 rounded-full ${attendanceMap[employee.id] ? 'bg-success' : 'bg-danger'}`} title={attendanceMap[employee.id] ? 'Present' : 'Absent'} />
                    {employee.role === 'admin' && <ShieldCheck className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-sm font-bold text-primary/80 uppercase tracking-widest">
                    {getTitle(employee.name) !== 'Team Member' ? getTitle(employee.name) : employee.department}
                  </p>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  <div className="flex items-center text-sm text-text-muted font-medium">
                    <Building className="w-4 h-4 mr-3 text-gray-400" />
                    {employee.department}
                  </div>
                  <div className="flex items-center text-sm text-text-muted font-medium">
                    <Mail className="w-4 h-4 mr-3 text-gray-400" />
                    {employee.email}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/20">
                  <div className="flex space-x-3">
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                      <Link className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  <RoleBadge role={employee.role} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isCreating && setShowAddModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-xl rounded-[40px] p-10 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-text-primary">Add Team Member</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-6 h-6 text-text-muted" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Full Name</label>
                <input
                  type="text" required
                  placeholder="enter username"
                  className="input h-14 px-6 border-none font-bold"
                  value={newEmp.name}
                  onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Department</label>
                   <input
                    type="text" required
                    placeholder="choose what you want to work on"
                    className="input h-14 px-6 border-none font-bold"
                    value={newEmp.department}
                    onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Role</label>
                  <select
                    required
                    className="input h-14 px-6 border-none font-bold appearance-none"
                    value={newEmp.role}
                    onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value as any })}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="Add your mail id if you want to"
                  className="input h-14 px-6 border-none font-bold"
                  value={newEmp.email}
                  onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-3 disabled:opacity-70 mt-4"
              >
                {isCreating ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Member</span>
                    <Plus className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-scale-up text-center">
            <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 text-danger">
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-text-primary mb-3">Delete User?</h3>
            <p className="text-text-muted mb-8 font-medium">Are you sure you want to delete <span className="text-text-primary font-black">{employeeToDelete?.name}</span>? This action cannot be undone.</p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleDeleteUser}
                className="w-full h-14 bg-danger text-white font-black rounded-2xl shadow-xl shadow-danger/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full h-14 text-text-muted font-black uppercase tracking-widest hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
