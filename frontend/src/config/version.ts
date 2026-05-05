// Application versioning and release notes
export const APP_VERSION = "1.0.0";

export const RELEASE_NOTES = [
  {
    version: "1.0.0",
    date: "May 5, 2026",
    title: "Session Update Summary",
    changes: [
      "Implemented comprehensive dark mode visibility fixes across dashboard pages and shared components",
      "Replaced hardcoded leave balance values with dynamic calculation from approved leave records",
      "Replaced hardcoded dashboard performance data with real-time task and attendance based metrics",
      "Fixed attendance presence percentage by counting unique attendance days and capping at 100%",
      "Fixed sidebar collapse not adjusting content layout",
      "Content now expands smoothly when sidebar minimizes",
      "Removed empty space on the left side",
      "Sidebar state now persists across sessions",
      "Improved transition animations when toggling sidebar",
      "Restricted release notes visibility to authenticated users only",
    ],
  },
];

export const getLatestVersion = () => RELEASE_NOTES[0];
export const getVersionNotes = (version: string) =>
  RELEASE_NOTES.find((r) => r.version === version);
