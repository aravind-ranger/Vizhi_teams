import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Clock,
  Calendar,
  Pause,
  Play,
  LogIn,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { db } from "../firebase.ts";
import {
  collection,
  query,
  getDocs,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { useTitle } from "../hooks/useTitle";
import Avatar from "../components/Avatar";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
  created_at: any;
  duration_minutes?: number;
  shift_minutes?: number;
  overtime_minutes?: number;
}

type ActionMeta = {
  label: string;
  tone: string;
  icon: React.ReactNode;
};

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  useTitle("Admin Logs");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "audit_logs"),
        orderBy("created_at", "desc"),
        limit(100),
      );
      const snap = await getDocs(q);
      const logData = snap.docs.map((doc) => {
        const data = doc.data();
        let createdAt;
        if (data.created_at?.toDate) {
          createdAt = data.created_at.toDate();
        } else if (data.created_at) {
          createdAt = new Date(data.created_at);
        } else {
          createdAt = new Date();
        }

        return {
          id: doc.id,
          ...data,
          created_at: createdAt,
        };
      }) as any as LogEntry[];
      setLogs(logData);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.user_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (log.details?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const logDate = format(log.created_at, "yyyy-MM-dd");
    const matchesDate = !selectedDate || logDate === selectedDate;
    return matchesSearch && matchesAction && matchesDate;
  });

  const getActionMeta = (action: string): ActionMeta => {
    switch (action) {
      case "checkin":
        return {
          label: "Check-in",
          tone: "bg-green-500/10 text-green-600 dark:text-green-400",
          icon: <LogIn className="w-4 h-4" />,
        };
      case "checkout":
        return {
          label: "Check-out",
          tone: "bg-red-500/10 text-red-600 dark:text-red-400",
          icon: <LogOut className="w-4 h-4" />,
        };
      case "pause":
      case "task_pause":
        return {
          label: "Break Start",
          tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          icon: <Pause className="w-4 h-4" />,
        };
      case "resume":
      case "task_resume":
        return {
          label: "Break End",
          tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
          icon: <Play className="w-4 h-4" />,
        };
      case "task_start":
        return {
          label: "Task Start",
          tone: "bg-primary/10 text-primary",
          icon: <Play className="w-4 h-4" />,
        };
      case "task_stop":
        return {
          label: "Task Complete",
          tone: "bg-green-500/10 text-green-600 dark:text-green-400",
          icon: <CheckCircle2 className="w-4 h-4" />,
        };
      case "overtime_start":
      case "overtime_stop":
        return {
          label: "Overtime",
          tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
          icon: <Clock className="w-4 h-4" />,
        };
      default:
        return {
          label: action.replace("_", " "),
          tone: "bg-gray-500/10 text-gray-600 dark:text-gray-300",
          icon: <Clock className="w-4 h-4" />,
        };
    }
  };

  const actionTotals = {
    checkin: logs.filter((log) => log.action === "checkin").length,
    checkout: logs.filter((log) => log.action === "checkout").length,
    breaks: logs.filter(
      (log) =>
        log.action === "pause" ||
        log.action === "resume" ||
        log.action === "task_pause" ||
        log.action === "task_resume",
    ).length,
    tasks: logs.filter(
      (log) => log.action === "task_start" || log.action === "task_stop",
    ).length,
    overtime: logs.filter(
      (log) =>
        log.action === "overtime_start" || log.action === "overtime_stop",
    ).length,
  };

  const summaryCards = [
    { label: "Total Logs", value: logs.length, accent: "text-text-primary" },
    {
      label: "Check-ins",
      value: actionTotals.checkin,
      accent: "text-green-600 dark:text-green-400",
    },
    {
      label: "Check-outs",
      value: actionTotals.checkout,
      accent: "text-red-600 dark:text-red-400",
    },
    {
      label: "Break Events",
      value: actionTotals.breaks,
      accent: "text-amber-600 dark:text-amber-400",
    },
    { label: "Task Events", value: actionTotals.tasks, accent: "text-primary" },
    {
      label: "Overtime",
      value: actionTotals.overtime,
      accent: "text-indigo-600 dark:text-indigo-400",
    },
  ];

  const activeDateLabel = selectedDate
    ? format(new Date(selectedDate), "MMM d, yyyy")
    : "All days";

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">Admin Logs</h2>
        <p className="text-sm text-text-muted">
          Real-time audit trail of employee activity, organized by action and
          time
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Viewing: <span className="text-text-primary">{activeDateLabel}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="glass rounded-2xl border-none shadow-sm p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
              {card.label}
            </p>
            <div className={`mt-2 text-2xl font-black ${card.accent}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 glass p-4 rounded-2xl border-none shadow-sm">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
          <div className="relative flex-1 min-w-0 w-full xl:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee or details..."
              className="input pl-10 h-11 border border-border/60 shadow-sm focus:bg-white dark:focus:bg-white/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-auto min-w-0">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                className="input h-11 pl-10 pr-4 w-full sm:w-[170px] border border-border/60 shadow-sm dark:bg-white/5 dark:focus:bg-white/10 text-sm font-medium cursor-pointer text-text-primary"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <select
              className="input h-11 px-4 w-full sm:w-[170px] border border-border/60 shadow-sm dark:bg-white/5 dark:focus:bg-white/10 text-sm font-medium cursor-pointer text-text-primary"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all" className="dark:bg-slate-800">
                All Actions
              </option>
              <option value="checkin" className="dark:bg-slate-800">
                Check-in
              </option>
              <option value="checkout" className="dark:bg-slate-800">
                Check-out
              </option>
              <option value="pause" className="dark:bg-slate-800">
                Break Start
              </option>
              <option value="resume" className="dark:bg-slate-800">
                Break End
              </option>
              <option value="task_start" className="dark:bg-slate-800">
                Task Start
              </option>
              <option value="task_stop" className="dark:bg-slate-800">
                Task Complete
              </option>
              <option value="overtime_start" className="dark:bg-slate-800">
                Overtime Start
              </option>
            </select>
            <button
              className="h-11 px-4 rounded-xl glass border border-border/60 hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm"
              title="Filter logs"
            >
              <Filter className="w-4 h-4" />
            </button>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="h-11 px-4 rounded-xl border border-border/60 text-sm font-semibold text-text-secondary whitespace-nowrap hover:bg-white/70 dark:hover:bg-white/10 transition-all shadow-sm"
              >
                Show all days
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass rounded-[32px] overflow-hidden border border-white/20 shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/20 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] bg-white/30 dark:bg-white/5">
              <th className="px-8 py-6">Timestamp</th>
              <th className="px-8 py-6">Employee</th>
              <th className="px-8 py-6">Action</th>
              <th className="px-8 py-6">Details</th>
              <th className="px-8 py-6 text-right">Shift (8h)</th>
              <th className="px-8 py-6 text-right">Overtime</th>
              <th className="px-8 py-6 text-right font-black">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-white/10 animate-pulse">
                  <td colSpan={7} className="px-8 py-6">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-8 py-12 text-center text-text-muted font-medium italic"
                >
                  No logs found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-white/10 hover:bg-white/60 dark:hover:bg-white/5 transition-all group"
                >
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-text-primary">
                        {format(log.created_at, "h:mm:ss a")}
                      </span>
                      <span className="text-[10px] font-medium text-text-muted uppercase tracking-widest">
                        {format(log.created_at, "MMM d, yyyy")}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3 min-w-0">
                      <Avatar name={log.user_name} size="xs" />
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-text-secondary block truncate">
                          {log.user_name}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
                          Audit subject
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="inline-flex items-center space-x-2 rounded-full px-3 py-2 bg-white dark:bg-white/10 border border-white/20 shadow-sm">
                      <div className="p-1.5 rounded-lg bg-white/80 dark:bg-white/5">
                        {getActionMeta(log.action).icon}
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-text-primary">
                        {getActionMeta(log.action).label}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="max-w-md">
                      <p className="text-sm text-text-primary font-medium line-clamp-2 leading-6">
                        {log.details}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {log.shift_minutes ? (
                      <span className="text-xs font-bold text-text-secondary bg-white/60 dark:bg-white/5 px-3 py-1 rounded-full whitespace-nowrap">
                        {Math.floor(log.shift_minutes / 60)}h {log.shift_minutes % 60}m
                      </span>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {log.overtime_minutes ? (
                      <span className="text-xs font-black text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full whitespace-nowrap">
                        {Math.floor(log.overtime_minutes / 60)}h {log.overtime_minutes % 60}m
                      </span>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {log.duration_minutes ? (
                      <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {(log.duration_minutes / 60).toFixed(1)}h
                      </span>
                    ) : (
                      "--"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLogs;
