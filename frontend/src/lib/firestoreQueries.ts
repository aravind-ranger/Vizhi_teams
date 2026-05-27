import {
  collection,
  limit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase";
import { getDayBounds, getMonthBounds } from "./firestoreDates";

export const recentLimit = 50;

const withDefined = (constraints: Array<QueryConstraint | false | null>) =>
  constraints.filter(Boolean) as QueryConstraint[];

export const todayAttendanceQuery = (userId: string, date = new Date()) => {
  const { start, end } = getDayBounds(date);
  return query(
    collection(db, "attendance"),
    where("user_id", "==", userId),
    where("created_at", ">=", start),
    where("created_at", "<", end),
    orderBy("created_at", "desc"),
    limit(1),
  );
};

export const attendanceRangeQuery = (
  start: Date,
  end: Date,
  userId?: string,
  max = 500,
) =>
  query(
    collection(db, "attendance"),
    ...withDefined([
      userId ? where("user_id", "==", userId) : null,
      where("created_at", ">=", start),
      where("created_at", "<", end),
      orderBy("created_at", "desc"),
      limit(max),
    ]),
  );

export const monthlyAttendanceQuery = (
  userId: string,
  date = new Date(),
  max = 80,
) => {
  const { start, end } = getMonthBounds(date);
  return attendanceRangeQuery(start, end, userId, max);
};

export const scopedTasksQuery = (user: any, max = recentLimit) => {
  const tasksRef = collection(db, "tasks");
  if (user?.role === "admin" || user?.role === "manager") {
    return query(tasksRef, orderBy("created_at", "desc"), limit(max));
  }

  return query(
    tasksRef,
    where("assigned_to", "==", user.id),
    orderBy("created_at", "desc"),
    limit(max),
  );
};

export const scopedProjectsQuery = (user: any, max = recentLimit) => {
  const projectsRef = collection(db, "projects");
  if (user?.role === "admin" || user?.role === "manager") {
    return query(projectsRef, orderBy("created_at", "desc"), limit(max));
  }

  return query(
    projectsRef,
    where("members", "array-contains", user.id),
    orderBy("created_at", "desc"),
    limit(max),
  );
};

export const unreadNotificationsQuery = (userId: string, max = 25) =>
  query(
    collection(db, "notifications"),
    where("user_id", "==", userId),
    limit(max),
  );

export const recentBroadcastNotificationsQuery = (max = 10) =>
  query(
    collection(db, "notifications"),
    where("user_id", "==", "all"),
    limit(max),
  );

export const recentNotificationsQuery = (max = 100) =>
  query(
    collection(db, "notifications"),
    orderBy("created_at", "desc"),
    limit(max),
  );
