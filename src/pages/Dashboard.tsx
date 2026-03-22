import React from 'react';
import { Student, PipelineStage } from '../types';
import { studentService } from '../services/studentService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';
import { getFlagEmoji } from '../utils/countryUtils';

const Dashboard: React.FC = () => {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const data = await studentService.getAll();
        setStudents(data);
      } catch (err) {
        console.error("Dashboard failed to load students", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium animate-pulse">Dashboard yükleniyor...</p>
      </div>
    );
  }

  // 1. Students by STATUS (PipelineStage)
  const statusCounts = Object.values(PipelineStage).map(stage => ({
    name: stage.toUpperCase(),
    count: students.filter(s => s.pipelineStage === stage).length
  })).filter(d => d.count > 0);

  // 2. Interested Countries (Aggregated from targetCountries & preferences)
  const countryMap: Record<string, number> = {};
  students.forEach(s => {
    const countries = new Set([
      ...(s.targetCountries || []),
      s.analysis?.preferences?.country1,
      s.analysis?.preferences?.country2,
      s.analysis?.preferences?.country3
    ].filter(Boolean));
    
    countries.forEach(c => {
      countryMap[c!] = (countryMap[c!] || 0) + 1;
    });
  });
  
  const countryData = Object.entries(countryMap)
    .map(([name, count]) => ({ 
      name: `${getFlagEmoji(name)} ${name}`, 
      count 
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 3. Visa Status (derived or explicitly set)
  // If visaStatus is null/empty, we derive from stage: ENROLLMENT=In Progress, STUDENT=Approved
  const visaStatusCounts = {
    'Approved': 0,
    'In Progress': 0,
    'Not Started': 0,
    'Rejected': 0
  };

  students.forEach(s => {
    const status = s.visaStatus || (
      s.pipelineStage === PipelineStage.STUDENT ? 'Approved' :
      s.pipelineStage === PipelineStage.ENROLLMENT ? 'In Progress' : 'Not Started'
    );
    visaStatusCounts[status as keyof typeof visaStatusCounts]++;
  });

  const visaData = Object.entries(visaStatusCounts)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  const totalBudget = students.reduce((sum, s) => sum + (s.budget || 0), 0);

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
        <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide">UNIC Dashboard</h2>
        <p className="text-slate-500 font-medium mt-1">Platform genelindeki durumlara dair güncel veriler.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Total Students" 
          value={students.length} 
          icon={Users} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="In Process" 
          value={students.filter(s => s.pipelineStage === PipelineStage.PROCESS).length} 
          icon={AlertTriangle} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Enrollment" 
          value={students.filter(s => s.pipelineStage === PipelineStage.ENROLLMENT).length} 
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
        {/* Chart 1: Students by STATUS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Students by STATUS</h3>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">Overall Pipeline</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}} />
                <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Interested Countries */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Interested Countries</h3>
             <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded">Top 5 Regions</span>
          </div>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical"
                data={countryData}
                margin={{ left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#475569', fontSize: 11, fontWeight: 700}}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" fill="#F59E0B" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Visa Status */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Visa Status Distribution</h3>
              <div className="flex gap-4">
                 {visaData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                       <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                       <span className="text-[10px] font-bold text-slate-500 uppercase">{d.name}</span>
                    </div>
                 ))}
              </div>
           </div>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {visaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                  />
                </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
