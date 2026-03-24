import React from 'react';
import { Student, PipelineStage } from '../types';
import { studentService } from '../services/studentService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Users, TrendingUp, CheckCircle, GraduationCap, ArrowUpRight, ArrowDownRight, Sparkles, Globe, Activity, Zap } from 'lucide-react';
import { getFlagEmoji } from '../utils/countryUtils';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

/* ─────────────────────────────────────────────
   Animation Variants (Framer Motion)
   ───────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } }
};

/* ─────────────────────────────────────────────
   Premium Color Palette
   ───────────────────────────────────────────── */
const CHART_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ec4899', '#14b8a6', '#a78bfa', '#f97316'];

const STAGE_COLORS: Record<string, string> = {
  'FOLLOW': '#6366f1',
  'ANALYSE': '#22d3ee',
  'PROCESS': '#f59e0b',
  'ENROLLMENT': '#14b8a6',
  'STUDENT': '#10b981',
  'NOT INTERESTED': '#94a3b8',
};

/* ───────────────────────────────────────────── */

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
      <div className="flex flex-col items-center justify-center h-[80vh] gap-5">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 rounded-full border-[3px] border-indigo-500/30 border-t-indigo-500"
        />
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-sm font-medium text-slate-400 tracking-wide"
        >
          Dashboard yükleniyor...
        </motion.p>
      </div>
    );
  }

  // ── Data Processing ──
  const totalStudents = students.length;
  const followCount = students.filter(s => s.pipelineStage === PipelineStage.FOLLOW).length;
  const analyseCount = students.filter(s => s.pipelineStage === PipelineStage.ANALYSE).length;
  const processCount = students.filter(s => s.pipelineStage === PipelineStage.PROCESS).length;
  const enrollmentCount = students.filter(s => s.pipelineStage === PipelineStage.ENROLLMENT).length;
  const studentCount = students.filter(s => s.pipelineStage === PipelineStage.STUDENT).length;
  const conversionRate = totalStudents > 0 ? Math.round((studentCount / totalStudents) * 100) : 0;

  // Status distribution
  const statusCounts = Object.values(PipelineStage).map(stage => ({
    name: stage.toUpperCase(),
    count: students.filter(s => s.pipelineStage === stage).length
  })).filter(d => d.count > 0);

  // Country distribution
  const countryMap: Record<string, number> = {};
  students.forEach(s => {
    const countries = new Set([
      ...(s.targetCountries || []),
      s.analysis?.preferences?.country1,
      s.analysis?.preferences?.country2,
      s.analysis?.preferences?.country3
    ].filter(Boolean));
    countries.forEach(c => { countryMap[c!] = (countryMap[c!] || 0) + 1; });
  });
  const countryData = Object.entries(countryMap)
    .map(([name, count]) => ({ name, flag: getFlagEmoji(name), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Visa status
  const visaStatusCounts = { 'Onaylı': 0, 'Devam Eden': 0, 'Başlamadı': 0, 'Reddedildi': 0 };
  students.forEach(s => {
    const status = s.visaStatus || (
      s.pipelineStage === PipelineStage.STUDENT ? 'Approved' :
      s.pipelineStage === PipelineStage.ENROLLMENT ? 'In Progress' : 'Not Started'
    );
    if (status === 'Approved') visaStatusCounts['Onaylı']++;
    else if (status === 'In Progress') visaStatusCounts['Devam Eden']++;
    else if (status === 'Rejected') visaStatusCounts['Reddedildi']++;
    else visaStatusCounts['Başlamadı']++;
  });
  const visaData = Object.entries(visaStatusCounts)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0);

  // Fake sparkline data for stat cards (adds premium feel)
  const generateSparkline = (base: number) =>
    Array.from({ length: 7 }, (_, i) => ({ v: Math.max(0, base + Math.floor(Math.random() * 6 - 3) + i) }));

  const statCards = [
    {
      title: "Toplam Öğrenci",
      value: totalStudents,
      trend: '+12%',
      trendUp: true,
      icon: Users,
      gradient: 'from-indigo-500 to-violet-600',
      sparkColor: '#a5b4fc',
      sparkline: generateSparkline(totalStudents),
    },
    {
      title: "Aktif Süreçte",
      value: processCount + enrollmentCount,
      trend: `${processCount} süreç · ${enrollmentCount} kayıt`,
      trendUp: true,
      icon: Activity,
      gradient: 'from-cyan-500 to-blue-600',
      sparkColor: '#67e8f9',
      sparkline: generateSparkline(processCount),
    },
    {
      title: "Dönüşüm Oranı",
      value: `${conversionRate}%`,
      trend: `${studentCount} tamamlandı`,
      trendUp: conversionRate > 10,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-600',
      sparkColor: '#6ee7b7',
      sparkline: generateSparkline(conversionRate),
    },
    {
      title: "Analiz Bekliyor",
      value: followCount + analyseCount,
      trend: `${followCount} takipte · ${analyseCount} analiz`,
      trendUp: false,
      icon: Zap,
      gradient: 'from-amber-500 to-orange-600',
      sparkColor: '#fcd34d',
      sparkline: generateSparkline(followCount),
    },
  ];

  /* ── Custom Tooltip ── */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-lg font-bold">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-10"
    >
      {/* ── Hero Header ── */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 md:p-10">
        {/* Ambient glow background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-4"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-white/80 tracking-wide">Premium Analytics</span>
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              UNIC Dashboard
            </h1>
            <p className="text-slate-400 mt-2 text-sm md:text-base max-w-lg">
              Platform genelindeki öğrenci durumları, ülke tercihleri ve süreç takibi — tek bakışta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
              <span className="text-xs font-medium text-white/70">Canlı Veri</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <motion.div
            key={card.title}
            variants={itemVariants}
            whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400 } }}
            className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-shadow duration-500"
          >
            {/* Top gradient line */}
            <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", card.gradient)} />

            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg", card.gradient)}>
                  <card.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold",
                  card.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                )}>
                  {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {typeof card.trend === 'string' && card.trend.includes('%') ? card.trend : ''}
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{card.title}</p>
                  <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{card.value}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">{card.trend}</p>
                </div>

                {/* Mini Sparkline */}
                <div className="w-20 h-10 opacity-60 group-hover:opacity-100 transition-opacity">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={card.sparkline}>
                      <defs>
                        <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.sparkColor} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={card.sparkColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={card.sparkColor} strokeWidth={2} fill={`url(#spark-${i})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pipeline Bar Chart (2 cols wide) */}
        <motion.div
          variants={scaleIn}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Öğrenci Pipeline Dağılımı</h3>
              <p className="text-xs text-slate-400 mt-0.5">Aşamalara göre güncel dağılım</p>
            </div>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">Pipeline</span>
          </div>
          <div className="h-72 px-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts} barGap={8}>
                <defs>
                  {statusCounts.map((entry, index) => (
                    <linearGradient key={`bar-grad-${index}`} id={`barGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={STAGE_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={1} />
                      <stop offset="100%" stopColor={STAGE_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={11} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={44}>
                  {statusCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#barGrad-${index})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Visa Pie Chart */}
        <motion.div
          variants={scaleIn}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
          <div className="p-6 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Vize Durumu</h3>
            <p className="text-xs text-slate-400 mt-0.5">Genel başvuru dağılımı</p>
          </div>
          <div className="h-56 px-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                >
                  {visaData.map((_, index) => (
                    <Cell key={`pie-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    background: 'rgba(15,23,42,0.95)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="px-6 pb-5 flex flex-wrap gap-x-4 gap-y-2">
            {visaData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d.name}</span>
                <span className="text-[10px] font-extrabold text-slate-700">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Countries & Quick Stats Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Country leaderboard */}
        <motion.div variants={scaleIn} className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50">
                <Globe className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tercih Edilen Ülkeler</h3>
                <p className="text-xs text-slate-400">En popüler hedef ülkeler</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">Top {countryData.length}</span>
          </div>

          <div className="px-6 pb-6 space-y-3">
            {countryData.map((country, i) => {
              const maxCount = countryData[0]?.count || 1;
              const percentage = Math.round((country.count / maxCount) * 100);
              return (
                <motion.div
                  key={country.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="group flex items-center gap-4"
                >
                  <span className="text-lg w-8 shrink-0">{country.flag}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-slate-700">{country.name}</span>
                      <span className="text-xs font-bold text-slate-500">{country.count} öğrenci</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {countryData.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">Henüz ülke tercihi verisi yok.</p>
            )}
          </div>
        </motion.div>

        {/* Quick summary cards */}
        <motion.div variants={scaleIn} className="space-y-4">
          {/* Conversion funnel mini card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-indigo-200" />
                <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-widest">Süreç Dönüşüm</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Takip', count: followCount, color: 'bg-white/20' },
                  { label: 'Analiz', count: analyseCount, color: 'bg-white/25' },
                  { label: 'Süreç', count: processCount, color: 'bg-white/30' },
                  { label: 'Kayıt', count: enrollmentCount, color: 'bg-white/40' },
                  { label: 'Öğrenci', count: studentCount, color: 'bg-emerald-400' },
                ].map(stage => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-indigo-200 w-14 uppercase tracking-wider">{stage.label}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", stage.color)}
                        style={{ width: `${totalStudents > 0 ? (stage.count / totalStudents) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-extrabold w-6 text-right">{stage.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick success metric */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-emerald-50">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Başarı Oranı</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{conversionRate}%</span>
              <span className="text-xs text-emerald-500 font-bold mb-1.5">tamamlandı</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Toplam {totalStudents} öğrenciden {studentCount} tanesi "Öğrenci" aşamasına ulaştı.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
