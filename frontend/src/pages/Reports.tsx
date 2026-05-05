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
} from "recharts";
import {
  Download,
  Filter,
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useTitle } from "../hooks/useTitle";

import { db } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuthStore } from "../store/useAuthStore";

const Reports: React.FC = () => {
  const { user } = useAuthStore();
  const [dateRange, setDateRange] = useState("This Week");
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState({
    barData: [] as any[],
    pieData: [] as any[],
    stats: [] as any[],
    logs: [] as any[],
  });
  useTitle("Reports");

  useEffect(() => {
    fetchReportData();
  }, [user, dateRange]);

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
          value: totalHours.toFixed(1),
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
            hours: ((t.total_minutes_logged || 0) / 60).toFixed(1),
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Reports</h2>
          <p className="text-sm text-text-muted">
            Analyze your productivity and performance
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn-secondary flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <div className="relative">
            <select
              className="input pr-10 appearance-none font-bold text-sm"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>Custom Range</option>
            </select>
            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="card p-8">
          <h3 className="text-lg font-bold text-text-primary mb-8">
            Weekly Work Hours
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height={320}>
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
                  tick={{ fill: "#868E96", fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#868E96", fontSize: 12, fontWeight: 500 }}
                />
                <Tooltip
                  cursor={{ fill: "currentColor", className: "text-border/10" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    backgroundColor: "var(--glass)",
                    color: "var(--text-primary)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                  }}
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

        <div className="card p-8">
          <h3 className="text-lg font-bold text-text-primary mb-8">
            Task Status Distribution
          </h3>
          <div className="h-80 w-full flex items-center">
            {reportData.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
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
                    {reportData.pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
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
              <div className="w-full text-center text-text-muted text-sm font-medium italic">
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
                      <p className="text-xs text-text-muted">{row.project}</p>
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
  );
};

export default Reports;
