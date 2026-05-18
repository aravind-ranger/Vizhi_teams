/**
 * CSV Export Utility
 * Provides functions to convert various data structures to CSV format and trigger downloads
 */

/**
 * Formats a value for CSV export, handling dates and objects
 */
const formatValueForCSV = (value: any): string => {
  if (value === null || value === undefined) {
    return "";
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Handle Firebase Timestamp objects (has toDate method)
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return String(value);
    }
  }

  // Handle other objects
  if (typeof value === "object") {
    // Check if it's a plain object with _seconds (Firestore timestamp-like)
    if (value._seconds !== undefined) {
      try {
        const date = new Date(value._seconds * 1000);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch (e) {
        return "";
      }
    }
    return JSON.stringify(value);
  }

  return String(value);
};

/**
 * Escapes CSV field values to handle commas, quotes, and newlines
 */
export const escapeCSVField = (field: any): string => {
  const formatted = formatValueForCSV(field);

  // If field contains comma, newline, or double quotes, wrap in quotes and escape quotes
  if (
    formatted.includes(",") ||
    formatted.includes("\n") ||
    formatted.includes('"')
  ) {
    return `"${formatted.replace(/"/g, '""')}"`;
  }

  return formatted;
};

/**
 * Converts an array of objects to CSV format
 */
export const convertToCSV = (data: any[], headers?: string[]): string => {
  if (!data || data.length === 0) {
    return "";
  }

  // Get headers from first object if not provided
  const csvHeaders =
    headers || Object.keys(data[0]).filter((key) => key !== "icon" && key !== "color");

  // Create header row
  const headerRow = csvHeaders.map(escapeCSVField).join(",");

  // Create data rows
  const dataRows = data.map((row) =>
    csvHeaders
      .map((header) => {
        const value = row[header];
        return escapeCSVField(value);
      })
      .join(","),
  );

  return [headerRow, ...dataRows].join("\n");
};

/**
 * Triggers a file download with the given content and filename
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
};

/**
 * Export admin dashboard data to CSV
 */
export const exportAdminReportCSV = (adminData: {
  overallStats: any[];
  companyTrend: any[];
  absences: any[];
  projectProgress: any[];
  teamProductivity: any[];
  employeeMetrics: any[];
}, month?: string): void => {
  const timestamp = new Date().toISOString().split("T")[0];
  const sections: string[] = [];

  // Overall Stats Section
  if (adminData.overallStats && adminData.overallStats.length > 0) {
    sections.push("OVERALL STATISTICS");
    sections.push(
      convertToCSV(adminData.overallStats, [
        "label",
        "value",
        "sub",
      ]),
    );
    sections.push("");
  }

  // Company Trend Section
  if (adminData.companyTrend && adminData.companyTrend.length > 0) {
    sections.push("TEAM ENGAGEMENT TREND");
    sections.push(
      convertToCSV(adminData.companyTrend, [
        "name",
        "productivity",
        "checkIns",
        "employees",
      ]),
    );
    sections.push("");
  }

  // Project Progress Section
  if (adminData.projectProgress && adminData.projectProgress.length > 0) {
    sections.push("PROJECT PROGRESS");
    sections.push(
      convertToCSV(adminData.projectProgress, [
        "name",
        "progress",
        "status",
        "completed",
        "total",
        "deadline",
      ]),
    );
    sections.push("");
  }

  // Team Productivity Section
  if (adminData.teamProductivity && adminData.teamProductivity.length > 0) {
    sections.push("TEAM PRODUCTIVITY");
    sections.push(
      convertToCSV(adminData.teamProductivity, [
        "name",
        "productivity",
        "hoursWorked",
        "tasksCompleted",
        "tasksAssigned",
      ]),
    );
    sections.push("");
  }

  // Absences Section
  if (adminData.absences && adminData.absences.length > 0) {
    sections.push("ATTENDANCE - ABSENCES");
    sections.push(
      convertToCSV(adminData.absences, [
        "name",
        "absences",
        "workDays",
        "percentage",
      ]),
    );
  }

  const csvContent = sections.join("\n");
  const filename = month
    ? `admin-report-${month}-${timestamp}.csv`
    : `admin-report-${timestamp}.csv`;
  downloadCSV(csvContent, filename);
};
