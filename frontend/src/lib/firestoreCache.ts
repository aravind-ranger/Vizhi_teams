import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Simple in-memory cache for expensive, rarely-changing queries (users list)
// TTL in ms
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type CacheEntry = {
  ts: number;
  data: any;
};

const cache: Record<string, CacheEntry> = {};

async function fetchActiveUsers() {
  // Only return active, non-admin users by default for most dashboards.
  const q = query(collection(db, "users"), where("is_active", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function getUsersCached(forceRefresh = false) {
  const key = "users:active";
  const now = Date.now();

  if (!forceRefresh && cache[key] && now - cache[key].ts < CACHE_TTL) {
    return cache[key].data;
  }

  const data = await fetchActiveUsers();
  cache[key] = { ts: now, data };
  return data;
}

async function fetchProjects() {
  // Prefer active projects but fall back to fetching all projects if none found.
  const activeQuery = query(collection(db, "projects"), where("status", "==", "active"));
  let snap = await getDocs(activeQuery);
  if (snap.empty) {
    // Fallback: fetch all projects (some records may not have `status` field)
    snap = await getDocs(collection(db, "projects"));
  }
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function getProjectsCached(forceRefresh = false) {
  const key = "projects:active";
  const now = Date.now();

  if (!forceRefresh && cache[key] && now - cache[key].ts < CACHE_TTL) {
    return cache[key].data;
  }

  const data = await fetchProjects();
  cache[key] = { ts: now, data };
  return data;
}

export function invalidateUsersCache() {
  delete cache["users:active"];
}

export function invalidateProjectsCache() {
  delete cache["projects:active"];
}

// Expose small debugging helper for local profiling
;(globalThis as any).__firestoreCache = {
  getUsersCached,
  getProjectsCached,
  invalidateUsersCache,
  invalidateProjectsCache,
};

export default getUsersCached;

