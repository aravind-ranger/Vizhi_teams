import React, { useEffect, useState } from "react";
import { Check, X, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { useTitle } from "../hooks/useTitle";
import Avatar from "../components/Avatar";
import { useAuthStore } from "../store/useAuthStore";
import { db } from "../firebase.ts";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

interface LateCheckInRequest {
  id: string;
  user_id: string;
  user_name: string;
  attendance_id: string;
  reason: string;
  details: string;
  status: "pending" | "approved" | "rejected";
  request_date?: string;
  requested_check_in?: Date | null;
  requested_scheduled_checkout?: string;
  created_at: Date;
}

const parseDateField = (value: any): Date | null => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const AdminLateCheckInRequests: React.FC = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<LateCheckInRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState("");

  useTitle("Late Check-In Requests");

  useEffect(() => {
    fetchRequests();
  }, [selectedDate]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const requestQuery = selectedDate
        ? query(
            collection(db, "late_checkin_requests"),
            where("request_date", "==", selectedDate),
            orderBy("created_at", "desc"),
            limit(100),
          )
        : query(
            collection(db, "late_checkin_requests"),
            orderBy("created_at", "desc"),
            limit(100),
          );
      const snap = await getDocs(requestQuery);

      const requestData = snap.docs.map((requestDoc) => {
        const data = requestDoc.data() as any;
        return {
          id: requestDoc.id,
          ...data,
          created_at: parseDateField(data.created_at) || new Date(),
          requested_check_in: parseDateField(data.requested_check_in),
        } as LateCheckInRequest;
      });

      setRequests(requestData);
    } catch (err) {
      console.error("Error fetching late check-in requests:", err);
      // Firestore may require a composite index for queries that combine
      // a where() on `request_date` with orderBy(`created_at`, 'desc').
      // Provide a graceful client-side fallback so the admin UI still works
      // while the required index is created in the Firebase console.
      try {
        const msg = (err as any)?.message || "";
        if (msg.includes("requires an index")) {
          console.warn(
            "Missing Firestore index for late_checkin_requests request_date+created_at — falling back to client-side filter.",
          );
          // Fetch a larger recent set and filter locally
          const fallbackSnap = await getDocs(
            query(
              collection(db, "late_checkin_requests"),
              orderBy("created_at", "desc"),
              limit(500),
            ),
          );
          const fallbackData = fallbackSnap.docs
            .map((requestDoc) => {
              const data = requestDoc.data() as any;
              return {
                id: requestDoc.id,
                ...data,
                created_at: parseDateField(data.created_at) || new Date(),
                requested_check_in: parseDateField(data.requested_check_in),
              } as LateCheckInRequest;
            })
            .filter((r) => (selectedDate ? r.request_date === selectedDate : true));
          setRequests(fallbackData);
        }
      } catch (fallbackErr) {
        console.error("Fallback fetch failed:", fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (
    request: LateCheckInRequest,
    decision: "approved" | "rejected",
  ) => {
    if (!user?.id) return;

    setActioningRequestId(request.id);
    try {
      await updateDoc(doc(db, "late_checkin_requests", request.id), {
        status: decision,
        reviewed_by: user.id,
        reviewed_by_name: user.name,
        reviewed_at: serverTimestamp(),
      });

      if (decision === "approved") {
        const requestedCheckIn = request.requested_check_in || new Date();
        const scheduledCheckout =
          request.requested_scheduled_checkout ||
          new Date(
            requestedCheckIn.getTime() + 8 * 60 * 60 * 1000,
          ).toISOString();

        await updateDoc(doc(db, "attendance", request.attendance_id), {
          status: "late_checkin",
          check_in: null,
          check_out: null,
          scheduled_checkout: scheduledCheckout,
          duration_minutes: 0,
          early_exit: false,
          auto_marked: false,
          late_checkin_approved: true,
          late_checkin_approved_at: serverTimestamp(),
          requested_check_in: requestedCheckIn.toISOString(),
        });

        await addDoc(collection(db, "audit_logs"), {
          user_id: request.user_id,
          user_name: request.user_name,
          action: "late_checkin_approved",
          details: `${request.user_name} late check-in approved by ${user.name}`,
          created_at: new Date(),
        });
      } else {
        await updateDoc(doc(db, "attendance", request.attendance_id), {
          status: "absent",
          check_in: null,
          check_out: null,
          scheduled_checkout: null,
          duration_minutes: 0,
        });

        await addDoc(collection(db, "audit_logs"), {
          user_id: request.user_id,
          user_name: request.user_name,
          action: "late_checkin_rejected",
          details: `${request.user_name} late check-in rejected by ${user.name}`,
          created_at: new Date(),
        });
      }

      await addDoc(collection(db, "notifications"), {
        user_id: request.user_id,
        title: `Late Check-In ${decision === "approved" ? "Approved" : "Rejected"}`,
        message:
          decision === "approved"
            ? "Your late check-in request was approved by admin."
            : "Your late check-in request was rejected. Attendance remains absent.",
        type: "late_checkin_decision",
        is_read: false,
        created_at: new Date(),
      });

      await fetchRequests();
    } catch (err) {
      console.error("Failed to process late check-in request:", err);
    } finally {
      setActioningRequestId(null);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">
          Late Check-In Requests
        </h2>
        <p className="text-sm text-text-muted">
          Review employee late check-in requests and approve or reject them
          here.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-auto min-w-0">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="date"
            className="input h-11 pl-10 pr-4 w-full sm:w-[170px] border border-border/60 shadow-sm dark:bg-white/5 dark:focus:bg-white/10 text-sm font-medium cursor-pointer text-text-primary"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        {selectedDate && (
          <button
            type="button"
            onClick={() => setSelectedDate("")}
            className="h-11 px-4 rounded-xl border border-border/60 text-sm font-semibold text-text-secondary whitespace-nowrap hover:bg-white/70 dark:hover:bg-white/10 transition-all shadow-sm"
          >
            Show all requests
          </button>
        )}
      </div>

      <div className="glass rounded-[32px] border border-white/20 shadow-sm p-6 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/20 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Requested Time</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2].map((i) => (
                  <tr
                    key={i}
                    className="border-b border-white/10 animate-pulse"
                  >
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-muted font-medium italic"
                  >
                    No late check-in requests found.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-white/10 hover:bg-white/60 dark:hover:bg-white/5 transition-all"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={request.user_name} size="xs" />
                        <span className="text-sm font-bold text-text-primary">
                          {request.user_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-text-secondary">
                      {request.requested_check_in
                        ? format(request.requested_check_in, "MMM d, h:mm a")
                        : "--"}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-text-primary">
                      {request.reason}
                    </td>
                    <td className="px-4 py-4 text-sm text-text-secondary max-w-[380px]">
                      <p className="whitespace-normal break-words leading-6">
                        {request.details}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          request.status === "approved"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : request.status === "rejected"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {request.status === "pending" ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleDecision(request, "approved")}
                            disabled={actioningRequestId === request.id}
                            className="h-9 px-3 rounded-lg bg-green-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Approve
                            </span>
                          </button>
                          <button
                            onClick={() => handleDecision(request, "rejected")}
                            disabled={actioningRequestId === request.id}
                            className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                          >
                            <span className="inline-flex items-center gap-1">
                              <X className="w-3 h-3" /> Reject
                            </span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-text-muted">
                          Processed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLateCheckInRequests;
