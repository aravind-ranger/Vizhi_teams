import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Timer,
  MapPin,
  Zap,
  UserCheck,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { useAttendance } from "../hooks/useAttendance";
import { useTitle } from "../hooks/useTitle";
import { db } from "../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuthStore } from "../store/useAuthStore";
import ProgressBar from "../components/ProgressBar";

const Attendance: React.FC = () => {
  const { user } = useAuthStore();
  const { attendance, checkIn, checkOut } = useAttendance();
  const [history, setHistory] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    presence_pct: 0,
    total_days: 0,
    total_needed: 0,
    avg_hours: 0,
    total_minutes: 0,
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  useTitle("Attendance");

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    fetchHistory();
  }, [user, selectedDate]);

  const fetchHistory = async () => {
    if (!user?.id) return;
    try {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      // Fetch Attendance - Simple query to avoid index errors
      const qAtt = query(
        collection(db, "attendance"),
        where("user_id", "==", user.id),
      );
      const attSnap = await getDocs(qAtt);

      interface AttendanceRecord {
        id: string;
        date: string;
        duration_minutes?: number;
        created_at?: any;
        [key: string]: any;
      }

      const allAttData = attSnap.docs.map((doc) => {
        const item = doc.data();
        const date = item.created_at?.toDate
          ? item.created_at.toDate()
          : new Date(item.check_in || item.created_at);
        return {
          id: doc.id,
          date: date.toISOString(),
          ...item,
        } as any as AttendanceRecord;
      });

      // Filter by current month in JS
      const attData = allAttData
        .filter((item) => {
          const d = new Date(item.date);
          return d >= monthStart && d <= monthEnd;
        })
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

      setHistory(attData);

      // Fetch Leaves
      const qLeaves = query(
        collection(db, "leaves"),
        where("user_id", "==", user.id),
        where("status", "==", "approved"),
      );
      const leavesSnap = await getDocs(qLeaves);
      const leavesData = leavesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setLeaves(leavesData);

      // Calculate Stats - Count unique dates only
      const uniqueDates = new Set(
        attData.map((record) => {
          const d = new Date(record.date);
          return d.toISOString().split("T")[0]; // Format: YYYY-MM-DD
        }),
      );
      const totalDaysPresent = uniqueDates.size;
      const totalMinutes = attData.reduce(
        (acc: number, curr) => acc + (curr.duration_minutes || 0),
        0,
      );
      const avgHours =
        totalDaysPresent > 0 ? totalMinutes / totalDaysPresent / 60 : 0;

      // Calculate needed days (weekdays in month up to today if current month, or all weekdays if past month)
      const isCurrentMonth = isSameDay(startOfMonth(new Date()), monthStart);
      const endOfCalculation = isCurrentMonth ? new Date() : monthEnd;
      const daysSoFar = eachDayOfInterval({
        start: monthStart,
        end: endOfCalculation,
      });
      const weekDaysNeeded = daysSoFar.filter(
        (d) => d.getDay() !== 0 && d.getDay() !== 6,
      ).length;

      setStats({
        presence_pct:
          Math.min(
            100,
            Math.round((totalDaysPresent / weekDaysNeeded) * 100),
          ) || 0,
        total_days: totalDaysPresent,
        total_needed: weekDaysNeeded,
        avg_hours: Number(avgHours.toFixed(1)),
        total_minutes: totalMinutes,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setSelectedDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setSelectedDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const totalWeekDaysInMonth = days.filter(
    (d) => d.getDay() !== 0 && d.getDay() !== 6,
  ).length;
  const monthlyTargetHours = totalWeekDaysInMonth * 8;

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">
            Attendance Center
          </h2>
          <p className="text-text-muted mt-1 font-medium">
            Verify your shift logs and daily presence
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-3 glass hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-all"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="glass px-6 py-3 rounded-2xl flex items-center space-x-3 border-none shadow-sm">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-black text-text-secondary uppercase tracking-widest">
              {format(selectedDate, "MMMM yyyy")}
            </span>
          </div>
          <button
            onClick={handleNextMonth}
            className="p-3 glass hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-all"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Real-time Widget */}
        <div className="xl:col-span-1 space-y-8">
          <div className="glass p-10 rounded-[40px] border-none shadow-sm relative overflow-hidden bg-primary text-white">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Timer className="w-32 h-32 rotate-12" />
            </div>

            <div className="relative z-10">
              <h3 className="text-xl font-black mb-10">Shift Pulse</h3>

              {!attendance?.check_in ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Zap className="w-10 h-10 text-white fill-current" />
                  </div>
                  <h4 className="text-2xl font-black mb-8">
                    Start your shift?
                  </h4>
                  <p className="text-sm font-bold text-white/60 uppercase tracking-[0.2em] animate-pulse">
                    Use the check-in button in the top bar
                  </p>
                </div>
              ) : attendance.check_out ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-6" />
                  <h4 className="text-2xl font-black">Shift Completed</h4>
                </div>
              ) : (
                <div className="space-y-10 text-center">
                  <div>
                    <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-2">
                      Checked in at
                    </p>
                    <p className="text-4xl font-black">
                      {format(new Date(attendance.check_in), "HH:mm a")}
                    </p>
                  </div>

                  <div className="w-full h-px bg-white/10" />

                  <p className="text-sm font-bold text-white/60 uppercase tracking-[0.2em] animate-pulse">
                    Checkout via top bar
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="glass p-8 rounded-[40px] border-none shadow-sm">
            <h3 className="text-xl font-black mb-8">Summary</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-text-muted">
                  Presence this month
                </span>
                <span className="text-lg font-black text-primary">
                  {stats.presence_pct}%
                </span>
              </div>
              <ProgressBar
                progress={stats.presence_pct}
                className="h-2 rounded-full"
              />
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">
                    Total Days
                  </p>
                  <p className="text-xl font-black text-text-primary">
                    {stats.total_days} / {stats.total_needed}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">
                    Avg. Hours
                  </p>
                  <p className="text-xl font-black text-text-primary">
                    {stats.avg_hours}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-[40px] border-none shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
            <h3 className="text-xl font-black mb-8">Work Hour Goal</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-text-muted">
                  Target: {monthlyTargetHours}h / Month
                </span>
                {(() => {
                  const isCurrentMonth = isSameDay(startOfMonth(new Date()), monthStart);
                  const hoursLogged = Math.floor(stats.total_minutes / 60);
                  const isGoalAchieved = hoursLogged >= monthlyTargetHours;
                  
                  let label = "In Progress";
                  let color = "text-primary bg-primary/10";
                  
                  if (isGoalAchieved) {
                    label = "Goal Achieved";
                    color = "text-success bg-success/10";
                  } else if (!isCurrentMonth) {
                    label = "Goal Missed";
                    color = "text-danger bg-danger/10";
                  }

                  return (
                    <span className={`text-[10px] font-black ${color} px-3 py-1.5 rounded-xl uppercase tracking-widest`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
              <ProgressBar
                progress={Math.min(
                  100,
                  (stats.total_minutes / (monthlyTargetHours * 60)) * 100,
                )}
                className="h-3 rounded-full bg-gray-100 dark:bg-white/5"
              />
              <div className="flex justify-between items-center text-[10px] font-black text-text-muted uppercase tracking-widest">
                <span>{Math.floor(stats.total_minutes / 60)}h Logged</span>
                <span>
                  {Math.max(0, monthlyTargetHours - Math.floor(stats.total_minutes / 60))}h Left
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="glass p-10 rounded-[40px] border-none shadow-sm h-full">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-text-primary tracking-tight">
                Shift Log
              </h3>
              <div className="flex items-center space-x-6 text-xs font-bold text-text-muted">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-success mr-2" />{" "}
                  Present
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-danger mr-2" /> Absent
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-warning mr-2" /> Leave
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2" />{" "}
                  Holiday
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-black text-text-muted uppercase tracking-widest mb-4"
                >
                  {d}
                </div>
              ))}

              {Array.from({ length: startOfMonth(selectedDate).getDay() }).map(
                (_, i) => (
                  <div key={`pad-${i}`} className="aspect-square" />
                ),
              )}

              {days.map((day, i) => {
                const dayLog = history.find((h) =>
                  isSameDay(new Date(h.date), day),
                );
                const isToday = isSameDay(day, new Date());
                const isSunday = day.getDay() === 0;

                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-3xl flex flex-col items-center justify-center relative group transition-all cursor-pointer ${
                      isToday
                        ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105 z-10"
                        : dayLog
                          ? "bg-success/10 dark:bg-success/20"
                          : isSunday
                            ? "bg-purple-50 dark:bg-purple-900/20"
                            : "bg-gray-50 dark:bg-slate-800/40"
                    }`}
                  >
                    <span
                      className={`text-sm font-black ${isToday ? "text-white" : "text-text-primary"}`}
                    >
                      {format(day, "d")}
                    </span>

                    <div className="absolute bottom-2 flex space-x-1">
                      {dayLog && (
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                      {leaves.some((l) => {
                        const from = l.from_date?.toDate
                          ? l.from_date.toDate()
                          : new Date(l.from_date);
                        const to = l.to_date?.toDate
                          ? l.to_date.toDate()
                          : new Date(l.to_date);
                        const d = new Date(day);
                        d.setHours(0, 0, 0, 0);
                        return d >= from && d <= to;
                      }) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                      )}
                      {isSunday && (
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      )}
                      {!dayLog &&
                        !isToday &&
                        day.getDay() !== 0 &&
                        day.getDay() !== 6 &&
                        day < new Date() &&
                        !leaves.some((l) => {
                          const from = l.from_date?.toDate
                            ? l.from_date.toDate()
                            : new Date(l.from_date);
                          const to = l.to_date?.toDate
                            ? l.to_date.toDate()
                            : new Date(l.to_date);
                          const d = new Date(day);
                          d.setHours(0, 0, 0, 0);
                          return d >= from && d <= to;
                        }) && (
                          <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 pt-10 border-t border-gray-100 dark:border-white/10">
              <h4 className="text-lg font-black text-text-primary mb-6">
                Recent Activity
              </h4>
              <div className="space-y-4">
                {isLoading
                  ? [1, 2].map((i) => (
                      <div key={i} className="skeleton h-16 rounded-2xl" />
                    ))
                  : history.slice(0, 5).map((log, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-5 bg-gray-50 dark:bg-white/5 rounded-2xl hover:bg-white dark:hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center space-x-6">
                          <div className="p-3 bg-white dark:bg-white/10 rounded-xl shadow-sm">
                            <UserCheck className="w-5 h-5 text-success" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-text-primary">
                              {format(new Date(log.date), "EEEE, MMMM d")}
                            </p>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                              Shift Logged
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-text-primary">
                            {log.duration_minutes
                              ? (log.duration_minutes / 60).toFixed(1) + "h"
                              : "0.0h"}
                          </p>
                          <p className="text-[10px] font-bold text-success uppercase tracking-widest mt-0.5">
                            Verified
                          </p>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
