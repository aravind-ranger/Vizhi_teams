import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  Legend
} from 'recharts';
import { 
  Download, Filter, Calendar as CalendarIcon, 
  ArrowUpRight, ArrowDownRight, TrendingUp 
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useTitle } from '../hooks/useTitle';

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState('This Week');
  useTitle('Reports');

  const barData = [
    { name: 'Mon', hours: 8.5 },
    { name: 'Tue', hours: 7.2 },
    { name: 'Wed', hours: 9.0 },
    { name: 'Thu', hours: 8.0 },
    { name: 'Fri', hours: 6.5 },
    { name: 'Sat', hours: 0 },
    { name: 'Sun', hours: 0 },
  ];

  const pieData = [
    { name: 'Done', value: 45, color: '#2F9E44' },
    { name: 'In Progress', value: 25, color: '#3B5BDB' },
    { name: 'Review', value: 15, color: '#F08C00' },
    { name: 'To Do', value: 15, color: '#ADB5BD' },
  ];

  const stats = [
    { label: 'Total Hours', value: '39.2', sub: '+12% vs last week', up: true },
    { label: 'Avg Productivity', value: '88%', sub: '-2% vs last week', up: false },
    { label: 'Tasks Completed', value: '18', sub: '+4 since Monday', up: true },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Reports</h2>
          <p className="text-sm text-text-muted">Analyze your productivity and performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn-secondary flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <div className="relative">
            <select 
              className="input pr-10 appearance-none bg-white font-bold text-sm"
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
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
        {stats.map((stat, i) => (
          <div key={i} className="card p-6">
            <p className="text-sm font-medium text-text-muted mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-extrabold text-text-primary">{stat.value}</h3>
              <div className={`flex items-center text-xs font-bold ${stat.up ? 'text-success' : 'text-danger'}`}>
                {stat.up ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                {stat.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="card p-8">
          <h3 className="text-lg font-bold mb-8">Weekly Work Hours</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#868E96', fontSize: 12, fontWeight: 500 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#868E96', fontSize: 12, fontWeight: 500 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#F8F9FA' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
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
          <h3 className="text-lg font-bold mb-8">Task Status Distribution</h3>
          <div className="h-80 w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  verticalAlign="middle" 
                  align="right" 
                  layout="vertical"
                  iconType="circle"
                  formatter={(value) => <span className="text-sm font-medium text-text-secondary ml-2">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-bold">Activity Log</h3>
          <button className="text-sm text-primary font-bold hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Task / Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {[
                { date: 'Apr 25, 2026', task: 'Setup DND for Kanban', project: 'Vizhi Teams', status: 'In Progress', hours: '4.5' },
                { date: 'Apr 24, 2026', task: 'Auth Controller logic', project: 'Vizhi Teams', status: 'Done', hours: '6.0' },
                { date: 'Apr 24, 2026', task: 'Team Meeting', project: 'Internal', status: 'Done', hours: '1.5' },
                { date: 'Apr 23, 2026', task: 'Design System Polish', project: 'Design Ops', status: 'Done', hours: '8.0' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-text-secondary font-medium">{row.date}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-text-primary">{row.task}</p>
                    <p className="text-xs text-text-muted">{row.project}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-text-primary">{row.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
