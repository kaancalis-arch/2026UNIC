import React from 'react';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, Globe2, Users2 } from 'lucide-react';
import { Student } from '../types';
import { studentService } from '../services/studentService';
import { getFlagEmoji } from '../utils/countryUtils';

const CHART_COLORS = ['#0f766e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#f97316', '#14b8a6'];

const Statistics: React.FC = () => {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadStudents = async () => {
      try {
        const data = await studentService.getAll();
        setStudents(data);
      } catch (error) {
        console.error('Statistics failed to load students', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, []);

  const countryData = React.useMemo(() => {
    const countryMap: Record<string, number> = {};

    students.forEach((student) => {
      const countries = new Set([
        ...(student.targetCountries || []),
        student.analysis?.preferences?.country1,
        student.analysis?.preferences?.country2,
        student.analysis?.preferences?.country3,
        student.analysis?.preferences?.country4,
        student.analysis?.preferences?.country5,
      ].filter(Boolean));

      countries.forEach((country) => {
        countryMap[country!] = (countryMap[country!] || 0) + 1;
      });
    });

    return Object.entries(countryMap)
      .map(([name, count]) => ({ name, flag: getFlagEmoji(name), count }))
      .sort((a, b) => b.count - a.count);
  }, [students]);

  const totalPreferences = countryData.reduce((sum, item) => sum + item.count, 0);
  const topCountry = countryData[0];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-slate-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
          <p className="text-lg font-bold">{payload[0].value}</p>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return <div className="p-10 text-slate-500">Statistics yukleniyor...</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-8 md:p-10">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -bottom-16 left-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/80">Statistics</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">Ulke Tercih Analizi</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
              Ogrenci tercihlerini ulke bazinda tek ekranda izleyebilir, yogunlasan destinasyonlari hizli sekilde gorebilirsin.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 backdrop-blur-sm">
            <BarChart3 className="h-4 w-4 text-cyan-300" />
            <span className="text-xs font-medium">Canli tercih ozeti</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 inline-flex rounded-xl bg-teal-50 p-3 text-teal-700">
            <Globe2 className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Toplam Ulke</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{countryData.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 inline-flex rounded-xl bg-sky-50 p-3 text-sky-700">
            <Users2 className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Toplam Tercih</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalPreferences}</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 inline-flex rounded-xl bg-amber-50 p-3 text-amber-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">En Cok Tercih</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{topCountry ? `${topCountry.flag} ${topCountry.name}` : '-'}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Tercih Dagilimi</h2>
              <p className="mt-1 text-xs text-slate-400">Ulke secimlerinin genel pasta grafik gorunumu</p>
            </div>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={countryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={122}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="name"
                  stroke="none"
                >
                  {countryData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Ulke Siralamasi</h2>
          <div className="mt-5 space-y-3">
            {countryData.map((country, index) => (
              <div key={country.name} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-500 shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{country.flag} {country.name}</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-slate-600">{country.count}</span>
              </div>
            ))}

            {countryData.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                Ulke tercihi verisi bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Statistics;
