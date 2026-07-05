import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AlertCircle, Clock, FileText } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useAttendanceStore } from "../store/useAttendanceStore";
import { useTitle } from "../hooks/useTitle";
import { getUsersCached } from "../lib/firestoreCache";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  doc,
  setDoc,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { formatDayKey } from "../lib/firestoreDates";

type LateRequestState = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  created_at?: Date;
} | null;

const LateCheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { attendance, fetchTodayAttendance, isLoading } = useAttendanceStore();

  const [reason, setReason] = useState("Traffic Delay");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayRequest, setTodayRequest] = useState<LateRequestState>(null);

  useTitle("Late Check-In Request");

  useEffect(() => {
    if (user?.id) {
      fetchTodayAttendance(user.id);
    }
  }, [fetchTodayAttendance, user?.id]);

  useEffect(() => {
    const fetchTodayRequest = async () => {
      if (!user?.id) return;

      const today = formatDayKey();
      const snap = await getDocs(
        query(
          collection(db, "late_checkin_requests"),
          where("user_id", "==", user.id),
          where("request_date", "==", today),
          limit(10),
        ),
      );

      if (snap.empty) {
        setTodayRequest(null);
        return;
      }

      const latest = snap.docs
        .map((requestDoc) => {
          const data = requestDoc.data() as any;
          const createdAt = data.created_at?.toDate
            ? data.created_at.toDate()
            : data.created_at
              ? new Date(data.created_at)
              : new Date(0);
          return {
            id: requestDoc.id,
            status: data.status,
            reason: data.reason,
            created_at: createdAt,
          } as LateRequestState extends null
            ? never
            : NonNullable<LateRequestState>;
        })
        .sort(
          (a, b) =>
            (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0),
        )[0];

      setTodayRequest(latest || null);
    };

    fetchTodayRequest().catch((err) => {
      console.error("Failed to fetch today's late check-in request", err);
    });
  }, [user?.id]);

  const submitRequest = async () => {
    if (!user?.id) return;
    if (todayRequest) {
      toast.error("You can only submit one late check-in request per day.");
      return;
    }
    if (!details.trim()) {
      toast.error("Please provide details for the late check-in request");
      return;
    }

    setIsSubmitting(true);
    try {
      const attendanceId =
        attendance?.id || `${user.id}_${formatDayKey()}`;

      if (!attendance?.id) {
        await setDoc(
          doc(db, "attendance", attendanceId),
          {
            user_id: user.id,
            user_name: user.name,
            check_in: null,
            check_out: null,
            scheduled_checkout: null,
            status: "absent",
            early_exit: false,
            duration_minutes: 0,
            work_location: "office",
            total_break_ms: 0,
            auto_marked: false,
            day_key: formatDayKey(),
            created_at: serverTimestamp(),
          },
          { merge: true },
        );
      }

      const existingRequestSnap = await getDocs(
        query(
          collection(db, "late_checkin_requests"),
          where("user_id", "==", user.id),
          where("request_date", "==", formatDayKey()),
          limit(1),
        ),
      );

      if (!existingRequestSnap.empty) {
        toast.error("You can only submit one late check-in request per day.");
        setIsSubmitting(false);
        return;
      }

      const requestedCheckIn = new Date();
      const scheduledCheckout = new Date(
        requestedCheckIn.getTime() + 8 * 60 * 60 * 1000,
      );

        await addDoc(collection(db, "late_checkin_requests"), {
        user_id: user.id,
        user_name: user.name,
          attendance_id: attendanceId,
          request_date: formatDayKey(),
        requested_check_in: requestedCheckIn.toISOString(),
        requested_scheduled_checkout: scheduledCheckout.toISOString(),
        reason,
        details: details.trim(),
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        created_at: serverTimestamp(),
      });

      await addDoc(collection(db, "audit_logs"), {
        user_id: user.id,
        user_name: user.name,
        action: "late_checkin_request",
        details: `${user.name} submitted a late check-in request: ${reason}`,
        created_at: new Date(),
      });

      const users = await getUsersCached();
      const admins = users.filter((u: any) => u.role === "admin");

      await Promise.all(
        admins.map((admin) =>
          addDoc(collection(db, "notifications"), {
            user_id: admin.id,
            title: "Late Check-In Request",
            message: `${user.name} submitted a late check-in request.`,
            type: "late_checkin_request",
            link: "/late-checkin-requests",
            is_read: false,
            created_at: new Date(),
          }),
        ),
      );

      toast.success("Late check-in request submitted for admin approval");
      navigate("/attendance");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit late check-in request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canRequest =
    (attendance?.status === "absent" || new Date().getHours() >= 11) &&
    !attendance?.check_in &&
    !isLoading &&
    !todayRequest;

  const requestStatusLabel =
    todayRequest?.status === "approved"
      ? "Approved"
      : todayRequest?.status === "rejected"
        ? "Rejected"
        : "Pending";

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          Late Check-In Request
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Submit your reason for coming late. Admin must approve before
          attendance is marked as late check-in.
        </p>
      </div>

      {!canRequest ? (
        <div className="glass rounded-3xl p-8 border border-border/40">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-warning mt-0.5" />
            <div>
              <p className="text-lg font-bold text-text-primary">
                {todayRequest
                  ? `Request ${requestStatusLabel}`
                  : "No Late Request Needed"}
              </p>
              <p className="text-sm text-text-muted mt-2">
                {todayRequest
                  ? "You have already submitted a late check-in request for today. Please use the top bar check-in button if it has been approved."
                  : "You can submit this only when today is auto-marked absent and no check-in exists."}
              </p>
              <button
                onClick={() => navigate("/attendance")}
                className="mt-5 h-11 px-5 rounded-xl bg-primary text-white font-bold"
              >
                Back to Attendance
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-8 border border-border/40 space-y-6">
          {todayRequest && (
            <div
              className={`rounded-2xl p-4 border ${
                todayRequest.status === "approved"
                  ? "bg-green-500/5 border-green-500/20"
                  : todayRequest.status === "rejected"
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
              }`}
            >
              <p className="text-[10px] uppercase tracking-widest font-black text-text-muted">
                Today&apos;s Request
              </p>
              <p className="text-sm font-bold text-text-primary mt-1">
                {requestStatusLabel}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {todayRequest.status === "approved"
                  ? "Approved requests are locked for today. Use the top bar check-in button to complete your attendance."
                  : todayRequest.status === "rejected"
                    ? "This request has already been reviewed. You cannot submit another one today."
                    : "Your request is waiting for admin review."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-danger/5 rounded-2xl p-4 border border-danger/20">
              <p className="text-[10px] uppercase tracking-widest font-black text-danger">
                Current Status
              </p>
              <p className="text-sm font-bold text-text-primary mt-1">Absent</p>
            </div>
            <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20">
              <p className="text-[10px] uppercase tracking-widest font-black text-amber-600">
                Requested Check-In Time
              </p>
              <p className="text-sm font-bold text-text-primary mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-text-muted">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input h-12 w-full border border-border/50"
            >
              <option>Traffic Delay</option>
              <option>Public Transport Issue</option>
              <option>Medical Reason</option>
              <option>Personal Emergency</option>
              <option>Family Responsibility</option>
              <option>Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-black text-text-muted flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain why you are late and include any relevant details..."
              className="w-full min-h-36 p-4 rounded-2xl border border-border/50 bg-white dark:bg-white/5 text-sm font-medium text-text-primary"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate("/attendance")}
              className="h-12 px-6 rounded-xl text-text-secondary font-bold hover:bg-gray-100 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={submitRequest}
              disabled={isSubmitting}
              className="h-12 px-6 rounded-xl bg-amber-500 text-white font-bold disabled:opacity-60"
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LateCheckIn;
