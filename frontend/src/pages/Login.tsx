import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Lock, User, ArrowRight, Zap, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');
      const { auth, db } = await import('../firebase.ts');

      const cleanUsername = email.trim().replace(/\s+/g, '').toLowerCase();
      const loginEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@gmail.com`;
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const firebaseUser = userCredential.user;

      // Fetch additional user info from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data() as any;
        const token = await firebaseUser.getIdToken();

        setAuth({
          id: firebaseUser.uid,
          name: userData.name || firebaseUser.displayName || 'User',
          email: firebaseUser.email!,
          role: userData.role || 'employee',
          department: userData.department,
          avatar_url: userData.avatar_url || firebaseUser.photoURL || undefined,
          is_active: userData.is_active ?? true,
          is_verified: userData.is_verified ?? true,
        }, token);

        toast.success(`Welcome back, ${userData.name?.split(' ')[0] || 'User'}!`);
        navigate('/');
      } else {
        toast.error('User profile not found in Firestore');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/20 mb-6">
            <Zap className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-2xl font-black text-text-primary tracking-tighter">VizhiTeams</h1>
          <p className="text-text-muted text-xs font-bold uppercase tracking-[0.3em] mt-2">Team Portal</p>
        </div>

        {/* Form Section */}
        <div className="bg-white p-10 rounded-[40px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] border border-gray-50">
          <div className="mb-10 text-center">
            <h2 className="text-xl font-black text-text-primary mb-2">Sign In</h2>
            <p className="text-text-muted text-sm font-medium">Access your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text" required
                  className="w-full h-14 pl-12 pr-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all outline-none font-bold text-sm"
                  placeholder="Enter your name"
                  value={email} onChange={e => setEmail(e.target.value.toLowerCase())}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Password</label>
                <button 
                  type="button"
                  onClick={() => setPassword(`${email}@123`)}
                  className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                  Use Default
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="password" required
                  className="w-full h-14 pl-12 pr-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all outline-none font-bold text-sm"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-16 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-3 disabled:opacity-70 mt-4"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 flex flex-col items-center space-y-4">
            <div className="h-px w-12 bg-gray-100" />
            <div className="flex items-center space-x-2 text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Secure Session</span>
            </div>
          </div>
        </div>

        <p className="text-center mt-10 text-[10px] font-bold text-text-muted uppercase tracking-widest">
          © 2026 Vizhi Teams • Engineering
        </p>
      </div>
    </div>
  );
};

export default Login;
