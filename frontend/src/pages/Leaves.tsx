import React, { useState, useEffect } from "react";
import {
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronRight,
  FileText,
  Check,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format, differenceInDays } from "date-fns";
import { useAuthStore } from "../store/useAuthStore";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import ProgressBar from "../components/ProgressBar";
import { useTitle } from "../hooks/useTitle";
import Avatar from "../components/Avatar";

interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: any;
}

const Leaves: React.FC = () => {
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "all">(
    user?.role === "admin" ? "all" : "my",
  );
  useTitle("Leaves");

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("leave_form_backup");
    return saved
      ? JSON.parse(saved)
      : {
          leave_type: "Sick",
          from_date: "",
          to_date: "",
          reason: "",
        };
  });

  const [balances, setBalances] = useState<any[]>([
    { type: "Sick", used: 0, total: 10, color: "bg-red-500" },
    { type: "Casual", used: 0, total: 12, color: "bg-amber-500" },
  ]);

  // Backup form to localStorage
  useEffect(() => {
    localStorage.setItem("leave_form_backup", JSON.stringify(form));
  }, [form]);

  // Calculate leave balances from actual leave data
  useEffect(() => {
    if (!user?.id) return;

    const userLeaves = leaves.filter(
      (l) => l.user_id === user.id && l.status === "approved",
    );

    const calculateDays = (leaveType: string) => {
      return userLeaves
        .filter((l) => l.leave_type === leaveType)
        .reduce((sum, l) => {
          const from = new Date(l.from_date);
          const to = new Date(l.to_date);
          const days =
            Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) +
            1;
          return sum + days;
        }, 0);
    };

    setBalances([
      {
        type: "Sick",
        used: calculateDays("Sick"),
        total: 10,
        color: "bg-red-500",
      },
      {
        type: "Casual",
        used: calculateDays("Casual"),
        total: 12,
        color: "bg-amber-500",
      },
    ]);
  }, [leaves, user?.id]);

  const formatDate = (dateInput: any, formatStr: string) => {
    if (!dateInput) return "N/A";
    try {
      const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      if (isNaN(date.getTime())) return "Invalid Date";
      return format(date, formatStr);
    } catch (err) {
      return "Error Date";
    }
  };

  useEffect(() => {
    const q = query(collection(db, "leaves"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const leavesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LeaveRequest[];
        setLeaves(leavesData);
        setIsLoading(false);
      },
      (err) => {
        console.error("Leaves listener error:", err);
        toast.error("Failed to load leaves");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "leaves"), {
        ...form,
        user_id: user?.id,
        employee_name: user?.name,
        status: "pending",
        created_at: serverTimestamp(),
      });
      toast.success("Leave application submitted!");
      setShowApplyModal(false);
      setForm({ leave_type: "Sick", from_date: "", to_date: "", reason: "" });
      localStorage.removeItem("leave_form_backup");
    } catch (err) {
      console.error("Submit leave error:", err);
      toast.error("Failed to submit application");
    }
  };

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const leaveRef = doc(db, "leaves", id);
      await updateDoc(leaveRef, { status });
      toast.success(`Leave request ${status}`);
      setShowApprovalModal(false);
    } catch (err) {
      console.error("Update status error:", err);
      toast.error("Failed to update status");
    }
  };

  const statusColors = {
    pending: "bg-amber-50 text-amber-600",
    approved: "bg-green-50 text-green-600",
    rejected: "bg-red-50 text-red-600",
  };

  const filteredLeaves =
    activeTab === "my" ? leaves.filter((l) => l.user_id === user?.id) : leaves;

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Leaves</h2>
          <p className="text-sm text-text-muted">
            Manage time off and approvals
          </p>
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
      {(user?.role === "admin" || user?.role === "manager") && (
        <div className="flex space-x-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("my")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "my" ? "bg-white dark:bg-primary shadow-sm text-primary dark:text-white" : "text-text-muted hover:text-text-primary"}`}
          >
            My Leaves
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "all" ? "bg-white dark:bg-primary shadow-sm text-primary dark:text-white" : "text-text-muted hover:text-text-primary"}`}
          >
            Team Requests
          </button>
        </div>
      )}

      {/* Balance Cards (Only for 'my' tab) */}
      {activeTab === "my" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {balances.map((b) => (
            <div key={b.type} className="card glass p-6 border-none shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-text-secondary">
                  {b.type} Leave
                </h3>
                <span className="text-sm font-bold">
                  {b.used} / {b.total} Days
                </span>
              </div>
              <ProgressBar
                progress={(b.used / b.total) * 100}
                color={b.color}
              />
              <p className="text-xs text-text-muted mt-4 font-medium">
                Remaining:{" "}
                <span className="text-text-primary font-bold">
                  {b.total - b.used} days
                </span>
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
                {activeTab === "all" && <th className="px-6 py-4">Employee</th>}
                <th className="px-6 py-4">Leave Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-text-muted"
                  >
                    No leave requests found
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => (
                  <tr
                    key={leave.id}
                    className="border-b border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                  >
                    {activeTab === "all" && (
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Avatar
                            name={leave.employee_name || ""}
                            size="xs"
                            className="mr-3"
                          />
                          <span className="text-sm font-bold">
                            {leave.employee_name}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 font-bold text-sm">
                      {leave.leave_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {formatDate(leave.from_date, "MMM d")} -{" "}
                      {formatDate(leave.to_date, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColors[leave.status]}`}
                      >
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedLeave(leave);
                          setShowApprovalModal(true);
                        }}
                        className="p-2 bg-gray-50 dark:bg-white/5 text-text-muted rounded-lg hover:bg-primary/10 dark:hover:bg-white/10 hover:text-primary transition-all"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowApprovalModal(false)}
          />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 rounded-[32px] w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h3 className="text-xl font-black text-text-primary">
                Review Request
              </h3>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-8 space-y-8">
              <div className="flex items-center space-x-4">
                <Avatar name={selectedLeave.employee_name || ""} size="lg" />
                <div>
                  <p className="text-lg font-black text-text-primary">
                    {selectedLeave.employee_name}
                  </p>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                    {selectedLeave.leave_type} Leave
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                  Reason for Leave
                </p>
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 italic text-sm text-text-secondary leading-relaxed">
                  "{selectedLeave.reason}"
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">
                    From
                  </p>
                  <p className="text-sm font-bold">
                    {formatDate(selectedLeave.from_date, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">
                    To
                  </p>
                  <p className="text-sm font-bold">
                    {formatDate(selectedLeave.to_date, "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {selectedLeave.status === "pending" && user?.role === "admin" ? (
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => updateStatus(selectedLeave.id, "rejected")}
                    className="flex-1 h-14 bg-danger/10 text-danger rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-danger hover:text-white transition-all shadow-lg shadow-danger/5"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => updateStatus(selectedLeave.id, "approved")}
                    className="flex-1 h-14 bg-success text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-success-dark transition-all shadow-lg shadow-success/20"
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-2xl text-center font-black text-xs uppercase tracking-widest ${statusColors[selectedLeave.status]}`}
                >
                  Status: {selectedLeave.status}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowApplyModal(false)}
          />
          <div className="relative bg-white dark:bg-glass dark:border dark:border-white/10 rounded-[40px] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-border dark:border-white/10 flex justify-between items-center">
              <h3 className="text-2xl font-black text-text-primary">
                Apply for Leave
              </h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <form onSubmit={handleApply} className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Leave Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {["Sick", "Casual"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, leave_type: t })}
                      className={`p-4 rounded-2xl border-2 transition-all text-center ${
                        form.leave_type === t
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20"
                      }`}
                    >
                      <span className="text-sm font-black">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    required
                    className="input h-14 px-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-text-primary dark:text-white font-bold dark:[color-scheme:dark]"
                    min={format(new Date(), "yyyy-MM-dd")}
                    value={form.from_date}
                    onChange={(e) =>
                      setForm({ ...form, from_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    required
                    className="input h-14 px-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-text-primary dark:text-white font-bold dark:[color-scheme:dark]"
                    min={form.from_date || format(new Date(), "yyyy-MM-dd")}
                    value={form.to_date}
                    onChange={(e) =>
                      setForm({ ...form, to_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                  Reason for Leave
                </label>
                <textarea
                  required
                  className="input min-h-[120px] py-4 px-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-text-primary dark:text-white placeholder:text-text-muted font-medium text-sm leading-relaxed"
                  placeholder="Please describe why you need this leave..."
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>

              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-text-muted uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaves;
