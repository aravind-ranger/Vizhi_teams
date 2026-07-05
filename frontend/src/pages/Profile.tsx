import React, { useState } from "react";
import {
  User,
  Shield,
  Key,
  Mail,
  Building,
  Briefcase,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useTitle } from "../hooks/useTitle";
import Avatar from "../components/Avatar";
import { toast } from "react-hot-toast";
import { db, auth } from "../firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

const Profile: React.FC = () => {
  const { user } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useTitle("My Profile");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsUpdating(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("No user logged in");

      // Re-authenticate
      const credential = EmailAuthProvider.credential(
        firebaseUser.email!,
        passwordForm.oldPassword,
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, passwordForm.newPassword);

      toast.success("Password updated successfully! 🔐");
      setShowPasswordModal(false);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        toast.error("Old password is incorrect");
      } else {
        toast.error("Failed to update password");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-text-primary">
            Profile Settings
          </h2>
          <p className="text-sm text-text-muted">
            Manage your personal information and security
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass p-8 rounded-[40px] text-center border border-gray-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative mb-6 inline-block">
              <Avatar
                name={user?.name || ""}
                url={user?.avatar_url}
                size="xl"
                className="ring-8 ring-white dark:ring-white/10 shadow-xl"
              />
            </div>
            <h3 className="text-xl font-black text-text-primary mb-1">
              {user?.name}
            </h3>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">
              {user?.role}
            </p>
            <div className="flex justify-center space-x-2">
              <span className="px-3 py-1 bg-success/10 text-success text-[10px] font-black rounded-lg uppercase tracking-widest border border-success/10">
                Active
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase tracking-widest border border-primary/10">
                {user?.department || "Operations"}
              </span>
            </div>
          </div>

          <div className="glass p-8 rounded-[40px] border border-gray-100 dark:border-white/10 shadow-sm space-y-4">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4">
              Security
            </h4>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 group hover:bg-primary/5 dark:hover:bg-white/10 transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm group-hover:text-primary transition-colors">
                  <Key className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-text-secondary group-hover:text-primary transition-colors">
                  Change Password
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass p-10 rounded-[40px] border border-gray-100 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-black text-text-primary mb-8 flex items-center">
              <User className="w-5 h-5 mr-3 text-primary" />
              Personal Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Full Name
                </label>
                <div className="flex items-center space-x-4 p-5 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                  <User className="w-4 h-4 text-text-muted" />
                  <span className="text-sm font-bold text-text-primary">
                    {user?.name}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <div className="flex items-center space-x-4 p-5 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <span className="text-sm font-bold text-text-primary">
                    {user?.email}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Department
                </label>
                <div className="flex items-center space-x-4 p-5 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                  <Building className="w-4 h-4 text-text-muted" />
                  <span className="text-sm font-bold text-text-primary">
                    {user?.department || "Engineering"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Role / Designation
                </label>
                <div className="flex items-center space-x-4 p-5 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                  <Briefcase className="w-4 h-4 text-text-muted" />
                  <span className="text-sm font-bold text-text-primary capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-10 rounded-[40px] border border-gray-100 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-black text-text-primary mb-8 flex items-center">
              <Shield className="w-5 h-5 mr-3 text-success" />
              Account Verification
            </h3>
            <div className="flex items-center justify-between p-6 bg-success/5 dark:bg-success/10 rounded-[32px] border border-success/10 dark:border-success/20">
              <div className="flex items-center space-x-6">
                <div className="w-14 h-14 bg-success/10 dark:bg-success/20 rounded-2xl flex items-center justify-center">
                  <Shield className="w-7 h-7 text-success" />
                </div>
                <div>
                  <p className="text-base font-black text-text-primary">
                    Verified Employee Account
                  </p>
                  <p className="text-xs text-text-muted font-medium">
                    Your account is fully verified and secure.
                  </p>
                </div>
              </div>
              <span className="px-4 py-2 bg-success text-white text-[10px] font-black rounded-xl uppercase tracking-widest">
                Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isUpdating && setShowPasswordModal(false)}
          />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 w-full max-w-md rounded-[40px] p-10 shadow-2xl animate-scale-up">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-black text-text-primary mb-2">
              Change Password
            </h2>
            <p className="text-text-muted text-sm font-medium mb-8">
              Secure your account by choosing a strong password.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Old Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 text-text-primary dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                  value={passwordForm.oldPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      oldPassword: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 text-text-primary dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full h-14 px-6 bg-white dark:bg-white/5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-white/10 text-text-primary dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full h-14 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center"
                >
                  {isUpdating ? "Updating..." : "Update Password"}
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full h-14 text-text-muted font-bold hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
