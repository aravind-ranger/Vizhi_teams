import { useAttendanceStore } from "../store/useAttendanceStore";

export type LateRequestStatus = "pending" | "approved" | "rejected" | null;

export const useTodayLateRequestStatus = () => {
  const lateRequestStatus = useAttendanceStore((state) => state.lateRequestStatus);
  const isLoading = false; // Synchronous from store

  return { status: lateRequestStatus, isLoading };
};
