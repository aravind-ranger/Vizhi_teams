import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  Download,
  Filter,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { useTitle } from "../hooks/useTitle";
import { exportAdminReportCSV } from "../utils/csvExport";

import { db } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuthStore } from "../store/useAuthStore";

const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const [dateRange, setDateRange] = useState("This Week");
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"personal" | "admin">(
    user?.role === "admin" ? "admin" : "personal",
  );
  const [reportData, setReportData] = useState({
    barData: [] as any[],
    pieData: [] as any[],
    stats: [] as any[],
    logs: [] as any[],
  });
  const [adminData, setAdminData] = useState({
    overallStats: [] as any[],
    companyTrend: [] as any[],
    absences: [] as any[],
    projectProgress: [] as any[],
    teamProductivity: [] as any[],
    employeeMetrics: [] as any[],
  });
  const [adminMonth, setAdminMonth] = useState<Date>(startOfMonth(new Date()));
  useTitle("Reports");

  useEffect(() => {
    if (user?.role === "admin" && viewMode !== "admin") {
      setViewMode("admin");
    }
  }, [user?.role, viewMode]);

  const handleExportCsvClick = () => {
    const monthStr = format(adminMonth, "MMM-yyyy");
    exportAdminReportCSV(adminData, monthStr);
  };

  useEffect(() => {
    if (user?.role === "admin" && viewMode === "admin") {
      fetchAdminData();
    } else {
      fetchReportData();
    }
  }, [user, dateRange, viewMode, adminMonth]);

  const fetchAdminData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch all users
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as any[];
      const employees = allUsers.filter(
        (u) => u.role === "employee" || u.role === "admin",
      );

      // 2. Fetch attendance records for selected month
      const monthStart = startOfMonth(adminMonth);
      const monthEnd = endOfMonth(adminMonth);
      let allAttendanceRecords: any[] = [];

      try {
        const monthAttendanceQ = query(
          collection(db, "attendance"),
          where("created_at", ">=", monthStart),
          where("created_at", "<=", monthEnd),
        );
        const allAttendanceSnap = await getDocs(monthAttendanceQ);
        allAttendanceRecords = allAttendanceSnap.docs.map(
          (d) => d.data() as any,
        );
      } catch (queryErr) {
        // Fallback if range query is unavailable due to index/config mismatch.
        console.warn(
          "Month attendance query failed, falling back to client filter",
          queryErr,
        );
        const allAttendanceSnap = await getDocs(collection(db, "attendance"));
        allAttendanceRecords = allAttendanceSnap.docs
          .map((d) => d.data() as any)
          .filter((a) => {
            const aDate = a.created_at?.toDate
              ? a.created_at.toDate()
              : new Date(a.created_at);
            return aDate >= monthStart && aDate <= monthEnd;
          });
      }

      // 3. Calculate absences for selected month
      const today = new Date();
      const isCurrentMonth =
        adminMonth.getFullYear() === today.getFullYear() &&
        adminMonth.getMonth() === today.getMonth();
      const absenceEndDate = isCurrentMonth ? today : monthEnd;

      // Get workdays in the selected month; for current month, only count up to today.
      const workDays: Date[] = [];
      const current = new Date(monthStart);
      while (current <= absenceEndDate) {
        if (current.getDay() !== 0 && current.getDay() !== 6) {
          workDays.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }

      const absenceMap: { [key: string]: any } = {};
      employees.forEach((emp) => {
        // Get attendance records for this employee in selected month
        const empRecords = allAttendanceRecords.filter((a) => {
          if (a.user_id !== emp.id) return false;
          const aDate = a.created_at?.toDate
            ? a.created_at.toDate()
            : new Date(a.created_at);
          return aDate >= monthStart && aDate <= monthEnd;
        });

        const presentDates = new Set(
          empRecords
            .filter((a) => a.check_in)
            .map((a) => {
              const d = a.created_at?.toDate
                ? a.created_at.toDate()
                : new Date(a.created_at);
              return format(d, "yyyy-MM-dd");
            }),
        );

        const absentDays = workDays.filter(
          (d) => !presentDates.has(format(d, "yyyy-MM-dd")),
        ).length;

        const workDaysCount = workDays.length;
        absenceMap[emp.id] = {
          name: emp.name || "Unknown",
          absences: absentDays,
          workDays: workDaysCount,
          percentage:
            workDaysCount > 0
              ? Math.round((absentDays / workDaysCount) * 100)
              : 0,
        };
      });

      const absenceList = Object.values(absenceMap).sort(
        (a, b) => b.absences - a.absences,
      );

      // 4. Fetch all projects
      const projectsSnap = await getDocs(collection(db, "projects"));
      const allProjects = projectsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as any[];

      // 5. Fetch all tasks
      const tasksSnap = await getDocs(collection(db, "tasks"));
      const allTasks = tasksSnap.docs.map((d) => d.data() as any);

      // 6. Calculate project progress
      const projectProgress = allProjects
        .filter((p) => String(p.status || "").toLowerCase() !== "dropped")
        .map((p) => {
          const projectTasks = allTasks.filter((t) => t.project_id === p.id);
          const completed = projectTasks.filter(
            (t) => t.status === "done",
          ).length;
          const total = projectTasks.length || 1;
          const progress = Math.round((completed / total) * 100);

          let status = "On Track";
          if (progress === 100) status = "Completed";
          else if (progress === 0) status = "Not Started";
          else if (progress > 50) status = "In Progress";
          else status = "At Risk";

          return {
            name: p.name || "Unnamed Project",
            progress,
            status,
            completed,
            total,
            deadline: p.end_date,
          };
        })
        .sort((a, b) => b.progress - a.progress);

      // 7. Calculate employee productivity
      const employeeProductivity = employees
        .map((emp) => {
          const empTasks = allTasks.filter((t) => t.assigned_to === emp.id);
          const completed = empTasks.filter((t) => t.status === "done").length;
          const total = empTasks.length;
          const productivity =
            total > 0 ? Math.round((completed / total) * 100) : 0;

          // Get hours worked in selected month
          const empRecords = allAttendanceRecords.filter((a) => {
            if (a.user_id !== emp.id) return false;
            const aDate = a.created_at?.toDate
              ? a.created_at.toDate()
              : new Date(a.created_at);
            return aDate >= monthStart && aDate <= monthEnd;
          });

          const totalHours = empRecords.reduce(
            (acc, a) => acc + (a.duration_minutes || 0) / 60,
            0,
          );

          return {
            name: emp.name || "Unknown",
            productivity,
            hoursWorked: totalHours,
            tasksCompleted: completed,
            tasksAssigned: total,
          };
        })
        .sort((a, b) => b.productivity - a.productivity);

      // 8. Trend data (last 7 days in selected month)
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const trendEndDate =
        endOfMonth(adminMonth) > new Date()
          ? new Date()
          : endOfMonth(adminMonth);
      const trendData = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(trendEndDate, i);
        const dateStr = format(d, "yyyy-MM-dd");
        const dayRecords = allAttendanceRecords.filter((a) => {
          const aDate = a.created_at?.toDate
            ? a.created_at.toDate()
            : new Date(a.created_at);
          return format(aDate, "yyyy-MM-dd") === dateStr;
        });

        const checkedOut = dayRecords.filter((a) => a.check_out).length;
        const checkedIn = dayRecords.filter((a) => a.check_in).length;
        const avgProductivity =
          checkedIn > 0 ? Math.round((checkedOut / checkedIn) * 100) : 0;

        return {
          name: days[d.getDay()],
          productivity: avgProductivity,
          checkIns: checkedIn,
          employees: new Set(dayRecords.map((a) => a.user_id)).size,
        };
      }).reverse();

      // 9. Calculate overall stats
      const totalEmployees = employees.length;
      const avgProductivity =
        employeeProductivity.length > 0
          ? Math.round(
              employeeProductivity.reduce((acc, e) => acc + e.productivity, 0) /
                employeeProductivity.length,
            )
          : 0;
      const activeProjects = allProjects.filter(
        (p) =>
          String(p.status || "").toLowerCase() === "active" ||
          String(p.status || "").toLowerCase() === "in_progress",
      ).length;
      const totalAbsences = absenceList.reduce((acc, a) => acc + a.absences, 0);

      const overallStats = [
        {
          label: "Total Employees",
          value: totalEmployees,
          sub: "Active staff",
          icon: Users,
          color: "text-blue-500",
        },
        {
          label: "Avg Productivity",
          value: `${avgProductivity}%`,
          sub: "Team average",
          icon: TrendingUp,
          color: "text-green-500",
        },
        {
          label: "Active Projects",
          value: activeProjects,
          sub: "In development",
          icon: Zap,
          color: "text-yellow-500",
        },
        {
          label: `Absences (${format(monthStart, "MMM yyyy")})`,
          value: totalAbsences,
          sub: "Team-wide",
          icon: AlertCircle,
          color: "text-red-500",
        },
      ];

      setAdminData({
        overallStats,
        companyTrend: trendData,
        absences: absenceList,
        projectProgress,
        teamProductivity: employeeProductivity,
        employeeMetrics: employeeProductivity,
      });
    } catch (err) {
      console.error("Failed to fetch admin data", err);
      // Reset data on error
      setAdminData({
        overallStats: [],
        companyTrend: [],
        absences: [],
        projectProgress: [],
        teamProductivity: [],
        employeeMetrics: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReportData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch Attendance for Bar Chart (last 7 days)
      const attQ = query(
        collection(db, "attendance"),
        where("user_id", "==", user.id),
        orderBy("created_at", "desc"),
      );
      const attSnap = await getDocs(attQ);
      const attDocs = attSnap.docs.map((d) => d.data() as any);

      // Process Bar Data (Last 7 Days)
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), i);
        return {
          name: days[d.getDay()],
          fullDate: format(d, "yyyy-MM-dd"),
          hours: 0,
        };
      }).reverse();

      attDocs.forEach((att) => {
        if (att.check_in) {
          try {
            const checkInDate = att.check_in.toDate
              ? att.check_in.toDate()
              : new Date(att.check_in);
            if (!isNaN(checkInDate.getTime())) {
              const dateStr = format(checkInDate, "yyyy-MM-dd");
              const day = last7Days.find((d) => d.fullDate === dateStr);
              if (day) {
                day.hours += (att.duration_minutes || 0) / 60;
              }
            }
          } catch (e) {
            console.error("Error parsing date:", e);
          }
        }
      });

      // 2. Fetch Tasks for Pie Chart
      const taskQ = query(
        collection(db, "tasks"),
        where("assigned_to", "==", user.id),
      );
      const taskSnap = await getDocs(taskQ);
      const tasks = taskSnap.docs.map((d) => d.data() as any);

      const statusCounts = {
        todo: tasks.filter((t) => t.status === "todo").length,
        in_progress: tasks.filter((t) => t.status === "in_progress").length,
        done: tasks.filter((t) => t.status === "done").length,
        pending: tasks.filter((t) => t.status === "pending").length,
      };

      const pieData = [
        { name: "Done", value: statusCounts.done, color: "#2F9E44" },
        {
          name: "In Progress",
          value: statusCounts.in_progress,
          color: "#3B5BDB",
        },
        { name: "To Do", value: statusCounts.todo, color: "#ADB5BD" },
        { name: "Pending", value: statusCounts.pending, color: "#F08C00" },
      ].filter((d) => d.value > 0);

      // 3. Fetch Scrum count
      const scrumQ = query(
        collection(db, "scrums"),
        where("user_id", "==", user.id),
      );
      const scrumSnap = await getDocs(scrumQ);
      const scrumCount = scrumSnap.size;

      // 4. Calculate Stats
      const totalHours = last7Days.reduce((acc, d) => acc + d.hours, 0);
      const tasksDone = statusCounts.done;
      const productivity =
        totalHours > 0
          ? Math.min(100, Math.round((tasksDone / (tasks.length || 1)) * 100))
          : 0;

      const stats = [
        {
          label: "Total Hours (Week)",
          value: totalHours.toFixed(2),
          sub: "Active tracking",
          up: true,
        },
        {
          label: "Avg Productivity",
          value: `${productivity}%`,
          sub: "Based on tasks",
          up: productivity > 50,
        },
        {
          label: "Scrums Attended",
          value: scrumCount.toString(),
          sub: "Daily participation",
          up: true,
        },
      ];

      setReportData({
        barData: last7Days,
        pieData,
        stats,
        logs: tasks.slice(0, 10).map((t) => {
          let dateStr = "Recently";
          if (t.created_at) {
            try {
              const d = t.created_at.toDate
                ? t.created_at.toDate()
                : new Date(t.created_at);
              if (!isNaN(d.getTime())) {
                dateStr = format(d, "MMM d, yyyy");
              }
            } catch (e) {}
          }
          return {
            date: dateStr,
            task: t.title,
            project: t.project_name,
            status: t.status,
            hours: ((t.total_minutes_logged || 0) / 60).toFixed(2),
          };
        }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        {/* Header with Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Reports</h2>
            <p className="text-sm text-text-muted">
              {viewMode === "admin"
                ? "Company-wide analytics and productivity insights"
                : "Analyze your productivity and performance"}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {user?.role === "admin" && viewMode === "admin" && (
              <div className="flex items-center gap-2 rounded-lg bg-white/5 dark:bg-white/10 p-1">
                <button
                  onClick={() =>
                    setAdminMonth((prev) => startOfMonth(subMonths(prev, 1)))
                  }
                  className="px-2 py-2 rounded hover:bg-white/10 transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4 text-text-primary" />
                </button>
                <div className="px-3 py-1.5 text-sm font-medium text-text-primary min-w-[120px] text-center">
                  {format(adminMonth, "MMM yyyy")}
                </div>
                <button
                  onClick={() =>
                    setAdminMonth((prev) => startOfMonth(addMonths(prev, 1)))
                  }
                  disabled={
                    startOfMonth(adminMonth).getTime() >=
                    startOfMonth(new Date()).getTime()
                  }
                  className="px-2 py-2 rounded hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4 text-text-primary" />
                </button>
              </div>
            )}
            {user?.role === "admin" && viewMode === "admin" && (
              <button
                onClick={handleExportCsvClick}
                className="btn-secondary flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Admin Dashboard View */}
        {viewMode === "admin" && user?.role === "admin" ? (
          <div className="space-y-8">
            {isLoading ? (
              <div className="space-y-6">
                {/* Loading Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="card p-6 animate-pulse">
                      <div className="h-4 bg-white/10 rounded w-24 mb-4"></div>
                      <div className="h-8 bg-white/10 rounded w-16 mb-2"></div>
                      <div className="h-3 bg-white/10 rounded w-20"></div>
                    </div>
                  ))}
                </div>
                <p className="text-center text-text-muted">
                  Loading admin dashboard...
                </p>
              </div>
            ) : (
              <>
                {/* Overall Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {adminData.overallStats.map((stat, i) => {
                    const IconComponent = stat.icon;
                    return (
                      <div key={i} className="card p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-text-muted mb-2">
                              {stat.label}
                            </p>
                            <h3 className="text-3xl font-extrabold text-text-primary">
                              {stat.value}
                            </h3>
                            <p className="text-xs text-text-muted mt-1">
                              {stat.sub}
                            </p>
                          </div>
                          <div
                            className={`p-3 rounded-lg bg-white/5 dark:bg-white/10 ${stat.color}`}
                          >
                            <IconComponent className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
                  {/* Company Productivity Trend */}
                  <div className="card p-8 h-auto flex flex-col self-stretch">
                    <h3 className="text-lg font-bold text-text-primary mb-6">
                      Team Engagement Trend
                    </h3>
                    <div className="w-full flex-shrink-0">
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={adminData.companyTrend}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="currentColor"
                            className="text-border/30"
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fill: "#868E96",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fill: "#868E96",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          />
                          <Tooltip
                            cursor={{
                              fill: "currentColor",
                              className: "text-border/10",
                            }}
                            contentStyle={{
                              borderRadius: "16px",
                              border: "none",
                              backgroundColor: "var(--glass)",
                              color: "var(--text-primary)",
                              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                            }}
                            formatter={(value) => [`${value}%`, "Productivity"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="productivity"
                            stroke="#3B5BDB"
                            strokeWidth={2}
                            dot={{ fill: "#3B5BDB", r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
                      {(() => {
                        const trend = adminData.companyTrend;
                        const bestDay = trend.reduce(
                          (best, item) =>
                            !best || item.productivity > best.productivity
                              ? item
                              : best,
                          null as any,
                        );
                        const averageProductivity = trend.length
                          ? Math.round(
                              trend.reduce(
                                (sum, item) => sum + (item.productivity || 0),
                                0,
                              ) / trend.length,
                            )
                          : 0;
                        const peakCheckIns = trend.reduce(
                          (best, item) =>
                            !best || item.checkIns > best.checkIns
                              ? item
                              : best,
                          null as any,
                        );

                        return [
                          {
                            label: "Average",
                            value: `${averageProductivity}%`,
                            sub: "7-day productivity",
                            accent: "text-primary",
                          },
                          {
                            label: "Best Day",
                            value: bestDay?.name || "—",
                            sub: bestDay
                              ? `${bestDay.productivity}% productivity`
                              : "No data",
                            accent: "text-green-600 dark:text-green-400",
                          },
                          {
                            label: "Peak Check-ins",
                            value: peakCheckIns?.checkIns?.toString() || "0",
                            sub: peakCheckIns ? peakCheckIns.name : "No data",
                            accent: "text-indigo-600 dark:text-indigo-400",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-2xl border border-border/60 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4"
                          >
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                              {item.label}
                            </p>
                            <p
                              className={`mt-2 text-xl font-black ${item.accent}`}
                            >
                              {item.value}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                              {item.sub}
                            </p>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Project Status Distribution */}
                  <div className="card p-8 h-auto flex flex-col self-stretch">
                    <h3 className="text-lg font-bold text-text-primary mb-6">
                      Project Progress Overview
                    </h3>
                    <div className="space-y-4 overflow-y-auto scrollbar-hide max-h-[420px]">
                      {adminData.projectProgress.map((proj, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-text-primary">
                              {proj.name.length > 30
                                ? proj.name.substring(0, 30) + "..."
                                : proj.name}
                            </p>
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded ${
                                proj.status === "Completed"
                                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                  : proj.status === "On Track"
                                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                    : proj.status === "In Progress"
                                      ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                      : "bg-red-500/20 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {proj.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white/5 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                                style={{ width: `${proj.progress}%` }}
                              />
                            </div>
                            <p className="text-xs font-bold text-text-muted min-w-max">
                              {proj.progress}%
                            </p>
                          </div>
                          <p className="text-xs text-text-muted">
                            {proj.completed} of {proj.total} tasks completed
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Employee Productivity Table */}
                <div className="card overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-bold text-text-primary">
                      Team Performance Metrics
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          <th className="px-6 py-4">Employee</th>
                          <th className="px-6 py-4">Productivity</th>
                          <th className="px-6 py-4">Tasks Completed</th>
                          <th className="px-6 py-4">Hours Worked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.teamProductivity.length > 0 ? (
                          adminData.teamProductivity
                            .slice(0, 10)
                            .map((emp, i) => (
                              <tr
                                key={i}
                                className="border-b border-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                              >
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-text-primary">
                                    {emp.name}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-white/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-green-500 to-green-600"
                                        style={{
                                          width: `${emp.productivity}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-sm font-bold text-text-primary">
                                      {emp.productivity}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-text-primary">
                                  {emp.tasksCompleted}/{emp.tasksAssigned}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-text-primary">
                                  {emp.hoursWorked.toFixed(1)}h
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-12 text-center text-text-muted font-medium italic"
                            >
                              No performance data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Absences Table */}
                {adminData.absences.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Employee Absences - {format(adminMonth, "MMM yyyy")}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Absences</th>
                            <th className="px-6 py-4">Attendance Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.absences.map((emp, i) => (
                            <tr
                              key={i}
                              className="border-b border-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-text-primary">
                                  {emp.name}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                                  {emp.absences} days
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-white/5 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                                      style={{
                                        width: `${100 - emp.percentage}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm font-bold text-text-primary">
                                    {100 - emp.percentage}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Personal Report View */
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reportData.stats.map((stat, i) => (
                <div key={i} className="card p-6">
                  <p className="text-sm font-medium text-text-muted mb-2">
                    {stat.label}
                  </p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-extrabold text-text-primary">
                      {stat.value}
                    </h3>
                    <div
                      className={`flex items-center text-xs font-bold ${stat.up ? "text-success" : "text-danger"}`}
                    >
                      {stat.up ? (
                        <ArrowUpRight className="w-4 h-4 mr-1" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 mr-1" />
                      )}
                      {stat.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
              <div className="card p-8 h-auto flex flex-col self-stretch">
                <h3 className="text-lg font-bold text-text-primary mb-6">
                  Weekly Work Hours
                </h3>
                <div className="w-full flex-shrink-0">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={reportData.barData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-border/30"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#868E96",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#868E96",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      />
                      <Tooltip
                        cursor={{
                          fill: "currentColor",
                          className: "text-border/10",
                        }}
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          backgroundColor: "var(--glass)",
                          color: "var(--text-primary)",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                        }}
                        formatter={(value: number) => [
                          value.toFixed(2),
                          "Hours",
                        ]}
                      />
                      <Bar
                        dataKey="hours"
                        fill="#3B5BDB"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-8 h-auto flex flex-col self-stretch">
                <h3 className="text-lg font-bold text-text-primary mb-6">
                  Task Status Distribution
                </h3>
                <div className="w-full flex-shrink-0 flex items-center justify-center">
                  {reportData.pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={reportData.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {reportData.pieData.map(
                            (entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ),
                          )}
                        </Pie>
                        <Tooltip />
                        <Legend
                          verticalAlign="middle"
                          align="right"
                          layout="vertical"
                          iconType="circle"
                          formatter={(value) => (
                            <span className="text-sm font-medium text-text-secondary ml-2">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center text-text-muted text-sm font-medium italic">
                      No task data available for this period.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="card overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-lg font-bold text-text-primary">
                  Recent Task Activity
                </h3>
                <button className="text-sm text-primary font-bold hover:underline">
                  View All Tasks
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      <th className="px-6 py-4">Created Date</th>
                      <th className="px-6 py-4">Task / Project</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Time Logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.logs.length > 0 ? (
                      reportData.logs.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                            {row.date}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-text-primary">
                              {row.task}
                            </p>
                            <p className="text-xs text-text-muted">
                              {row.project}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-white/5 text-text-muted">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-bold text-text-primary">
                            {row.hours}h
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-12 text-center text-text-muted font-medium italic"
                        >
                          No recent activity found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Reports;
