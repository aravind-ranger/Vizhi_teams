import React, { useState, useEffect } from 'react';
import {
  Search, Mail, Briefcase, MapPin,
  Link, Share2, MoreHorizontal, UserCheck,
  ExternalLink, Building, ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { useTitle } from '../hooks/useTitle';
import Avatar from '../components/Avatar';
import RoleBadge from '../components/RoleBadge';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  department: string;
  is_active: boolean;
  avatar_url: string;
  created_at: string;
}

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  useTitle('Team Members');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = (name: string) => {
    const nameMap: Record<string, string> = {
      'Aadhi': 'Founder',
      'Sathish': 'Co-Founder',
      'Abdul': 'CEO',
      'Aravind': 'CTO',
      'Guru Gokul': 'Intern',
      'Shreeram': 'Intern'
    };
    return nameMap[name] || 'Team Member';
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight">Our People</h2>
          <p className="text-text-muted mt-1 font-medium">The heartbeat of Vizhi Teams</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-12 pr-4 glass border-none rounded-[20px] focus:ring-4 focus:ring-primary/10 shadow-sm outline-none font-medium"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-[420px] rounded-[40px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="group glass p-8 rounded-[40px] border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden"
            >
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-colors" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-8">
                  <Avatar name={employee.name} size="xl" src={employee.avatar_url} className="ring-4 ring-white shadow-xl" />
                  <button className="p-2 hover:bg-white/50 rounded-2xl transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-text-muted" />
                  </button>
                </div>

                <div className="mb-8">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-xl font-black text-text-primary group-hover:text-primary transition-colors">
                      {employee.name}
                    </h3>
                    {employee.role === 'admin' && <ShieldCheck className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-sm font-bold text-primary/80 uppercase tracking-widest">
                    {getTitle(employee.name)}
                  </p>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  <div className="flex items-center text-sm text-text-muted font-medium">
                    <Building className="w-4 h-4 mr-3 text-gray-400" />
                    {employee.department}
                  </div>
                  <div className="flex items-center text-sm text-text-muted font-medium">
                    <Mail className="w-4 h-4 mr-3 text-gray-400" />
                    {employee.email}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/20">
                  <div className="flex space-x-3">
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                      <Link className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  <RoleBadge role={employee.role} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Employees;
