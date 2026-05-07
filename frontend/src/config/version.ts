// Application versioning and release notes
export const APP_VERSION = "1.0.1";

export const RELEASE_NOTES = [
  {
    version: "1.0.1",
    date: "May 7, 2026",
    title: "Projects & UI Refinement",
    changes: [
      "Added List View toggle to Projects hub for better management of high-volume projects",
      "Implemented structured Task List view within Project Details",
      "Fixed dark mode visibility for project members and advanced filter menus",
      "Standardized avatar rings (high-contrast) and theme-aware backgrounds across all modules",
      "Cleaned up Kanban task cards by removing unnecessary placeholders",
      "Resolved hover state visibility issues in the Tasks advanced filter panel",
      "Fixed missing Search and Navigation icons in the Projects module",
      "Professionalized Sidebar UI by removing browser focus rings and standardizing logo contrast",
    ],
  },
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
