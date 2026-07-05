// Application versioning and release notes
export const APP_VERSION = "1.2.0";

export const RELEASE_NOTES = [
  {
    version: "1.2.0",
    date: "May 26, 2026",
    title: "Attendance Workflow & Admin Review",
    changes: [
      "Added automatic absence marking after the morning cutoff for employees who have not checked in",
      "Created a dedicated Late Check-In request page so employees can submit a reason and details instead of forcing a normal check-in",
      "Added admin approve/reject actions for late check-in requests with notification and audit log updates",
      "Preserved late_checkin as its own attendance status so approved requests do not appear as normal present entries",
      "Updated the admin attendance summary to show present, late check-in, and absent counts separately",
      "Expanded admin request tables so late check-in details remain fully readable during review",
      "Blocked direct check-in from the attendance hook when an auto-absent record already exists",
      "Added a dedicated admin-only Late Check-In Requests tab in the sidebar for centralized approval workflow",
      "Implemented real-time late check-in status tracking so approval/rejection updates are reflected immediately in employee flows",
      "Added requester notifications when admins approve or reject late check-in requests",
      "Blocked Daily Scrum submission when late check-in is pending or rejected until admin approval",
      "Timers now require Daily Scrum submission to start; employees must submit a Daily Scrum to start their timer",
      "Blocked task creation and task start actions when late check-in is pending or rejected until admin approval",
      "Enforced check-in prerequisite before Daily Scrum submission with a locked-state screen for non-checked-in users",
      "Enforced check-in prerequisite before task create/start actions for non-admin users",
      "Removed the admin My Report toggle so admins stay focused on the Admin Dashboard report view",
      "Fixed the admin Dashboard Present Today count to include checked-out employees and users without an explicit inactive flag",
      "Refined Dashboard visibility to focus on users checked in today by removing absent-user display widgets",
      "Removed select advanced features from the employee interface while retaining full admin privileges to streamline employee workflows and reduce complexity",
    ],
  },
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
