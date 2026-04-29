import React from 'react'; // App Component
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import { db } from './firebase';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Pages (to be created)
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Projects = React.lazy(() => import('./pages/Projects'));
const ProjectDetails = React.lazy(() => import('./pages/ProjectDetails'));
const Employees = React.lazy(() => import('./pages/Employees'));
const Attendance = React.lazy(() => import('./pages/Attendance'));
const DailyScrum = React.lazy(() => import('./pages/DailyScrum'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Tasks = React.lazy(() => import('./pages/Tasks'));
const FocusMode = React.lazy(() => import('./components/FocusMode'));
const Leaves = React.lazy(() => import('./pages/Leaves'));
const Sprints = React.lazy(() => import('./pages/Sprints'));
const AdminLogs = React.lazy(() => import('./pages/AdminLogs.tsx'));

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { token, user } = useAuthStore();
  const [isFocusMode, setIsFocusMode] = React.useState(false);

  if (!token) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" />;

  return (
    <div className="flex bg-background min-h-screen">
      {!isFocusMode && <Sidebar />}
      <div className={`flex-1 ${!isFocusMode ? 'lg:ml-0' : ''} transition-all duration-250`}>
        <div className={!isFocusMode ? 'lg:pl-60' : ''}>
          {!isFocusMode && <TopBar onFocusMode={() => setIsFocusMode(true)} />}
          <main className={!isFocusMode ? 'p-6 pt-2' : ''}>
            {isFocusMode && (
              <React.Suspense fallback={null}>
                <FocusMode onClose={() => setIsFocusMode(false)} />
              </React.Suspense>
            )}
            <React.Suspense fallback={<div className="skeleton w-full h-96 rounded-card" />}>
              {children}
            </React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { setAuth, logout } = useAuthStore();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
      try {
        if (firebaseUser) {
          console.log('[Auth] User detected:', firebaseUser.uid);
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (userDoc.exists()) {
            console.log('[Auth] Profile found:', userDoc.data());
            const userData = userDoc.data();
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
          } else {
            console.error('[Auth] Profile NOT found in Firestore for UID:', firebaseUser.uid);
            toast.error(`Profile not found in database. Check Firestore collection "users" for document: ${firebaseUser.uid}`);
            logout();
          }
        } else {
          console.log('[Auth] No user detected');
          logout();
        }
      } catch (err: any) {
        console.error('[Auth] Error fetching profile:', err);
        toast.error('Error connecting to database');
        logout();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setAuth, logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#1A1A1A',
            borderRadius: '16px',
            fontSize: '14px',
            fontWeight: '600',
            padding: '12px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
            border: '1px solid #F1F5F9'
          }
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Routes */}
        <Route path="/employees" element={
          <ProtectedRoute>
            <Employees />
          </ProtectedRoute>
        } />
        <Route path="/attendance" element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        } />
        <Route path="/leaves" element={
          <ProtectedRoute>
            <Leaves />
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id" element={
          <ProtectedRoute>
            <ProjectDetails />
          </ProtectedRoute>
        } />
        <Route path="/tasks" element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        } />
        <Route path="/sprints" element={
          <ProtectedRoute>
            <Sprints />
          </ProtectedRoute>
        } />
        <Route path="/daily-scrum" element={
          <ProtectedRoute>
            <DailyScrum />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } />
        <Route path="/admin-logs" element={
          <ProtectedRoute roles={['admin']}>
            <AdminLogs />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
