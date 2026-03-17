import React, { useState, useMemo } from 'react';
import { Award, CheckCircle, Clock, XCircle, Search, Filter, TrendingUp, Users, Globe } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Student, PipelineStage } from '../types';
import { studentService } from '../services/studentService';

const VisaResults: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const data = await studentService.getAll();
        // Filter students that have advanced to enrollment or graduation, or have explicit visa status
        setStudents(data.filter(s => 
          s.pipelineStage === PipelineStage.ENROLLMENT || 
          s.pipelineStage === PipelineStage.STUDENT || 
          s.visaStatus
        ));
      } catch (err) {
        console.error("Failed to load visa results", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const visaResults = useMemo(() => {
    return students.map(s => ({
      id: s.id,
      student: `${s.firstName} ${s.lastName}`,
      country: s.analysis?.preferences?.country1 || (s.targetCountries && s.targetCountries[0]) || 'Other',
      type: s.targetDegree || 'Student Visa',
      status: s.visaStatus || (s.pipelineStage === PipelineStage.STUDENT ? 'Approved' : 'Pending'),
      date: 'Active'
    }));
  }, [students]);

  const filteredResults = useMemo(() => {
    return visaResults.filter(item => {
      const matchesSearch = item.student.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesCountry = countryFilter === 'All' || item.country === countryFilter;
      return matchesSearch && matchesStatus && matchesCountry;
    });
  }, [visaResults, searchQuery, statusFilter, countryFilter]);

  const stats = useMemo(() => {
    const total = filteredResults.length;
    const approved = filteredResults.filter(r => r.status === 'Approved').length;
    const pending = filteredResults.filter(r => r.status === 'Pending').length;
    const rejected = filteredResults.filter(r => r.status === 'Rejected').length;
    const successRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, pending, rejected, successRate };
  }, [filteredResults]);

  const chartData = useMemo(() => {
    return [
      { name: 'Approved', value: stats.approved, color: '#10b981' },
      { name: 'Pending', value: stats.pending, color: '#f59e0b' },
      { name: 'Rejected', value: stats.rejected, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const countryData = useMemo(() => {
    const counts: Record<string, { Approved: number, Pending: number, Rejected: number }> = {};
    filteredResults.forEach(r => {
      if (!counts[r.country]) {
        counts[r.country] = { Approved: 0, Pending: 0, Rejected: 0 };
      }
      counts[r.country][r.status as 'Approved' | 'Pending' | 'Rejected']++;
    });
    return Object.entries(counts).map(([name, data]) => ({ name, ...data }));
  }, [filteredResults]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredResults.forEach(r => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredResults]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'Pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
      case 'Rejected':
        return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold flex items-center gap-1">{status}</span>;
    }
  };

  const countries = Array.from(new Set(visaResults.map(r => r.country)));

  if (loading) {
    return <div className="h-96 flex items-center justify-center text-slate-400">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Visa Results</h2>
          <p className="text-slate-500 text-sm">Track and manage visa application outcomes.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search student..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <select 
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">Tüm Durumlar</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Applications', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Success Rate', value: `${stats.successRate}%`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Sonuç Dağılımı (Distribution)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Ülkelere Göre Sonuçlar</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Legend />
                <Bar dataKey="Approved" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Visa Type Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} width={80} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Öğrenci</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ülke</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vize Tipi</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vize Sonucu</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vize Başvuru Tarihi (date)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredResults.map((result) => (
              <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-800">{result.student}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{result.country}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{result.type}</span>
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(result.status)}
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-500">{result.date}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View Details</button>
                </td>
              </tr>
            ))}
            {filteredResults.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500 italic">
                  No results found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VisaResults;
