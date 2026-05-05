import React from "react"; // App Component
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast, ToastBar } from "react-hot-toast";
import { X } from "lucide-react";
import { useAuthStore } from "./store/useAuthStore";
import { useSidebarStore } from "./store/useSidebarStore";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ReleaseNotesModal from "./components/ReleaseNotesModal";
import { APP_VERSION } from "./config/version";
import { db } from "./firebase";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

// Pages (to be created)
const Login = React.lazy(() => import("./pages/Login"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Projects = React.lazy(() => import("./pages/Projects.tsx"));
const ProjectDetails = React.lazy(() => import("./pages/ProjectDetails.tsx"));
const Employees = React.lazy(() => import("./pages/Employees.tsx"));
const Attendance = React.lazy(() => import("./pages/Attendance.tsx"));
const DailyScrum = React.lazy(() => import("./pages/DailyScrum.tsx"));
const Reports = React.lazy(() => import("./pages/Reports.tsx"));
const Tasks = React.lazy(() => import("./pages/Tasks"));
const CalendarPage = React.lazy(() => import("./pages/Calendar"));
const FocusMode = React.lazy(() => import("./components/FocusMode"));
const Leaves = React.lazy(() => import("./pages/Leaves"));
const Sprints = React.lazy(() => import("./pages/Sprints"));
const Meets = React.lazy(() => import("./pages/Meets"));
const AdminLogs = React.lazy(() => import("./pages/AdminLogs.tsx"));
const Profile = React.lazy(() => import("./pages/Profile"));

const ProtectedRoute = ({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) => {
  const { token, user } = useAuthStore();
  const { isCollapsed } = useSidebarStore();
  const [isFocusMode, setIsFocusMode] = React.useState(false);

  if (!token) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" />;

  return (
    <div className="flex bg-background min-h-screen">
      {!isFocusMode && <Sidebar />}
      <div className={`flex-1 transition-all duration-300`}>
        <div
          className={
            !isFocusMode ? (isCollapsed ? "lg:pl-[80px]" : "lg:pl-[280px]") : ""
          }
        >
          {!isFocusMode && <TopBar onFocusMode={() => setIsFocusMode(true)} />}
          <main className={!isFocusMode ? "p-6 pt-2" : ""}>
            {isFocusMode && (
              <React.Suspense fallback={null}>
                <FocusMode onClose={() => setIsFocusMode(false)} />
              </React.Suspense>
            )}
            <React.Suspense
              fallback={<div className="skeleton w-full h-96 rounded-card" />}
            >
              {children}
            </React.Suspense>
          </main>
        </div>
      </div>
    </div>
  );
};

import { useThemeStore } from "./store/useThemeStore";

function App() {
  const { setAuth, logout, token } = useAuthStore();
  const { theme } = useThemeStore();
  const [loading, setLoading] = React.useState(true);
  const [showReleaseNotes, setShowReleaseNotes] = React.useState(false);

  // Show release notes only for authenticated users and only once per version.
  React.useEffect(() => {
    if (loading || !token) {
      setShowReleaseNotes(false);
      return;
    }

    const lastSeenVersion = localStorage.getItem("vizhi_last_version");
    if (lastSeenVersion !== APP_VERSION) {
      setShowReleaseNotes(true);
      localStorage.setItem("vizhi_last_version", APP_VERSION);
    }
  }, [loading, token]);

  React.useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  React.useEffect(() => {
    let profileUnsubscribe: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: any) => {
        try {
          if (firebaseUser) {
            // Use onSnapshot for real-time profile updates (syncs status, name, etc.)
            profileUnsubscribe = onSnapshot(
              doc(db, "users", firebaseUser.uid),
              async (userDoc) => {
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  const token = await firebaseUser.getIdToken();
                  setAuth(
                    {
                      id: firebaseUser.uid,
                      name: userData.name || firebaseUser.displayName || "User",
                      email: firebaseUser.email!,
                      role: userData.role || "employee",
                      department: userData.department,
                      avatar_url:
                        userData.avatar_url ||
                        firebaseUser.photoURL ||
                        undefined,
                      is_active: userData.is_active ?? true,
                      is_verified: userData.is_verified ?? true,
                      availability_status:
                        userData.availability_status || "available",
                    },
                    token,
                  );
                  setLoading(false);
                } else {
                  console.error("[Auth] Profile NOT found in Firestore");
                  toast.error("Profile not found in database.");
                  logout();
                  setLoading(false);
                }
              },
            );
          } else {
            logout();
            setLoading(false);
          }
        } catch (err: any) {
          console.error("[Auth] Auth error:", err);
          logout();
          setLoading(false);
        }
      },
    );

    return () => {
      authUnsubscribe();
      profileUnsubscribe();
    };
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
            background: "#fff",
            color: "#1A1A1A",
            borderRadius: "16px",
            fontSize: "14px",
            fontWeight: "600",
            padding: "12px 24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.05)",
            border: "1px solid #F1F5F9",
          },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                <div className="flex-1 px-2">{message}</div>
                {t.type !== "loading" && (
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Routes */}
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaves"
          element={
            <ProtectedRoute>
              <Leaves />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sprints"
          element={
            <ProtectedRoute>
              <Sprints />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meets"
          element={
            <ProtectedRoute>
              <Meets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-scrum"
          element={
            <ProtectedRoute>
              <DailyScrum />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-logs"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {token && (
        <ReleaseNotesModal
          isOpen={showReleaseNotes}
          onClose={() => setShowReleaseNotes(false)}
        />
      )}
    </BrowserRouter>
  );
}

export default App;
