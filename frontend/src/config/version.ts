// Application versioning and release notes
export const APP_VERSION = "1.1.0";

export const RELEASE_NOTES = [
  {
    version: "1.1.0",
    date: "May 18, 2026",
    title: "Security Hardening & Data Export",
    changes: [
      "Removed localStorage token storage: Firebase ID tokens now fetched at request time, eliminating XSS attack vectors",
      "Implemented strict Content-Security-Policy meta tag to reduce XSS attack surface",
      "Enhanced logout flow to properly sign out from Firebase and clear persisted sessions",
      "Added CSV export functionality: Admin can now export task, project, and report data for offline analysis",
      "Refactored AuthState: Removed token field, managed token lifecycle exclusively via Firebase SDK",
      "Updated API interceptor to attach Firebase tokens at request time with automatic expiry refresh",
      "All protected routes now check user state instead of token for clarity and maintainability",
    ],
  },
  {
    version: "1.0.3",
    date: "May 15, 2026",
    title: "Advanced Report's & Admin Insights",
    changes: [
      "Added advanced Reports dashboard for admins with team productivity, absence tracking, and project progress",
      "Fixed dark-mode hover contrast across the site",
    ],
  },
  {
    version: "1.0.2",
    date: "May 7, 2026",
    title: "Analytics & Productivity Optimization",
    changes: [
      "Enhanced Attendance module with a dynamic 'Monthly Work Hour Goal' based on total working days",
      "Corrected Dashboard performance scoring to include all completed task types (Done & Completed)",
      "Refined Dashboard 'Active Tasks' to focus exclusively on 'In Progress' items",
      "Restricted Reports CSV export functionality to Admin users only",
      "Streamlined Reports UI by removing redundant date filters and standardizing decimal precision",
      "Professionalized Profile view by removing the photo upload overlay for a cleaner aesthetic",
      "Fixed dark mode legibility for task detail fields and dropdown containers",
      "Finalized Project List view with full responsive support and administrative actions",
    ],
  },
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
