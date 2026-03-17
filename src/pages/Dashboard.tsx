
import React from 'react';
import { MOCK_STUDENTS } from '../services/mockData';
import { PipelineStage } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';

const Dashboard: React.FC = () => {
  // Prepare chart data
  const stageCounts = Object.values(PipelineStage).map(stage => ({
    name: stage,
    count: MOCK_STUDENTS.filter(s => s.pipelineStage === stage).length
  })).filter(d => d.count > 0);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const totalBudget = MOCK_STUDENTS.reduce((sum, s) => sum + s.budget, 0);

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`p-4 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Counselor Dashboard</h2>
        <p className="text-slate-500">Welcome back. Here's what's happening today.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Total Students" 
          value={MOCK_STUDENTS.length} 
          icon={Users} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="In Process" 
          value={MOCK_STUDENTS.filter(s => s.pipelineStage === PipelineStage.PROCESS).length} 
          icon={AlertTriangle} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Enrollment" 
          value={MOCK_STUDENTS.filter(s => s.pipelineStage === PipelineStage.ENROLLMENT).length} 
          icon={CheckCircle} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Total Pipeline Value" 
          value={`$${(totalBudget / 1000).toFixed(1)}k`} 
          icon={DollarSign} 
          color="bg-blue-500" 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Students by Pipeline Stage</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageCounts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Target Degrees</h3>
          <div className="h-64 flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Master', value: 60 },
                    { name: 'Bachelor', value: 30 },
                    { name: 'PhD', value: 10 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stageCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
