import React from 'react';
import { Student, PipelineStage } from '../types';
import { studentService } from '../services/studentService';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { getFlagEmoji } from '../utils/countryUtils';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { CalendarEntry, CalendarEvent, EVENT_TYPES, formatEventTime } from '../components/Calendar';
import { calendarService } from '../services/calendarService';

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

const CHART_COLORS = ['#0f766e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e'];

const STORAGE_ENTRIES_KEY = 'unic_calendar_entries';
const STORAGE_EVENTS_KEY = 'unic_calendar_events';
const DAY_MS = 1000 * 60 * 60 * 24;

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateKey: string) => {
  const parsedDate = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateKey;
  }

  return parsedDate.toLocaleDateString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  });
};

const Dashboard: React.FC = () => {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [calendarEntries, setCalendarEntries] = React.useState<CalendarEntry[]>([]);
  const [calendarEvents, setCalendarEvents] = React.useState<CalendarEvent[]>([]);
  const [selectedTimelineDate, setSelectedTimelineDate] = React.useState(() => formatDateKey(new Date()));

  const today = React.useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  }, []);

  const todayIso = formatDateKey(today);

  const getReminderMeta = React.useCallback((date?: string) => {
    if (!date) {
      return { isVisible: false, isCritical: false, diffInDays: null as number | null };
    }

    const reminder = new Date(`${date}T00:00:00`);
    if (Number.isNaN(reminder.getTime())) {
      return { isVisible: true, isCritical: false, diffInDays: null as number | null };
    }

    const diffInDays = Math.floor((today.getTime() - reminder.getTime()) / DAY_MS);
    const isVisible = reminder.getTime() <= today.getTime();

    return {
      isVisible,
      isCritical: isVisible && diffInDays >= 4,
      diffInDays
    };
  }, [today]);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const data = await studentService.getAll();
        setStudents(data);

        const remoteCalendar = await calendarService.getAll();
        let nextEntries = remoteCalendar.entries;
        let nextEvents = remoteCalendar.events;

        if (nextEntries.length === 0) {
          const storedEntries = localStorage.getItem(STORAGE_ENTRIES_KEY);
          if (storedEntries) {
            try {
              nextEntries = JSON.parse(storedEntries);
            } catch {
              nextEntries = [];
            }
          }
        }

        if (nextEvents.length === 0) {
          const storedEvents = localStorage.getItem(STORAGE_EVENTS_KEY);
          if (storedEvents) {
            try {
              nextEvents = JSON.parse(storedEvents);
            } catch {
              nextEvents = [];
            }
          }
        }

        setCalendarEntries(nextEntries);
        setCalendarEvents(nextEvents);
      } catch (err) {
        console.error('Dashboard failed to load students', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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

  const countryData = Object.entries(countryMap)
    .map(([name, count]) => ({ name, flag: getFlagEmoji(name), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const selectedDayData = React.useMemo(() => {
    const dayEvents = calendarEvents
      .filter((event) => event.date === selectedTimelineDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dayEntries = calendarEntries.filter((entry) => entry.date === selectedTimelineDate);
    const dayStudents = students.filter((student) => student.reminderDate === selectedTimelineDate);

    return {
      dayEvents,
      dayEntries,
      dayStudents,
    };
  }, [calendarEntries, calendarEvents, selectedTimelineDate, students]);

  const stageCards = React.useMemo(() => {
    return [
      {
        title: 'Follow',
        stage: PipelineStage.FOLLOW,
        gradient: 'from-indigo-500 to-indigo-700',
        badgeClass: 'bg-indigo-50 text-indigo-700',
      },
      {
        title: 'Analyse',
        stage: PipelineStage.ANALYSE,
        gradient: 'from-sky-500 to-cyan-700',
        badgeClass: 'bg-sky-50 text-sky-700',
      },
      {
        title: 'Process',
        stage: PipelineStage.PROCESS,
        gradient: 'from-amber-500 to-orange-600',
        badgeClass: 'bg-amber-50 text-amber-700',
      },
      {
        title: 'Enrollment',
        stage: PipelineStage.ENROLLMENT,
        gradient: 'from-emerald-500 to-teal-600',
        badgeClass: 'bg-emerald-50 text-emerald-700',
      },
    ].map((item) => {
      const stageStudents = students.filter((student) => student.pipelineStage === item.stage);
      const visibleStageStudents = stageStudents.filter((student) => getReminderMeta(student.reminderDate).isVisible);
      const criticalCount = stageStudents.filter((student) => getReminderMeta(student.reminderDate).isCritical).length;

      return {
        ...item,
        count: visibleStageStudents.length,
        totalCount: stageStudents.length,
        criticalCount,
        route: `students?stage=${encodeURIComponent(item.stage)}`,
      };
    });
  }, [getReminderMeta, students]);

  const changeTimelineDay = (offset: number) => {
    const nextDate = new Date(`${selectedTimelineDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + offset);
    setSelectedTimelineDate(formatDateKey(nextDate));
  };

  const handleCardNavigation = (route: string) => {
    window.location.hash = route;
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, route: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardNavigation(route);
    }
  };

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
          Dashboard yukleniyor...
        </motion.p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-10"
    >
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 md:p-10">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-600/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
              <span className="text-xs font-medium text-white/70">Canli Veri</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
        {stageCards.map((card) => (
          <motion.div
            key={card.title}
            variants={itemVariants}
            whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400 } }}
            role="button"
            tabIndex={0}
            aria-label={`${card.title} ogrencilerini goruntule`}
            onClick={() => handleCardNavigation(card.route)}
            onKeyDown={(event) => handleCardKeyDown(event, card.route)}
            className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-teal-500/5 transition-shadow duration-500 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <div className={cn('absolute top-0 left-0 right-0 h-1 bg-gradient-to-r', card.gradient)} />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-baseline gap-2 mt-1">
                     <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{card.count}</h3>
                     <span className="text-base font-bold text-slate-300">/</span>
                     <span className="text-2xl font-extrabold text-rose-600">{card.criticalCount}</span>
                  </div>
                </div>
                <div className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', card.badgeClass)}>
                  {card.title}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 flex items-center justify-between gap-3">
                <p className="text-[10px] text-slate-500 font-medium">Toplam data</p>
                <span className="text-sm font-bold text-slate-800">{card.totalCount}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <motion.div
          variants={scaleIn}
          role="button"
          tabIndex={0}
          aria-label="Takvim sayfasini ac"
          onClick={() => handleCardNavigation('calendar')}
          onKeyDown={(event) => handleCardKeyDown(event, 'calendar')}
          className="flex h-full min-h-[220px] max-h-[360px] flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-xl hover:shadow-teal-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          <div className="flex items-center justify-between p-6 pb-3">
            <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Takvim</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  changeTimelineDay(-1);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Onceki gun"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-2 rounded-xl bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider">
                {formatDisplayDate(selectedTimelineDate)}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  changeTimelineDay(1);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Sonraki gun"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 px-6 pb-6 space-y-3 overflow-y-auto">
            {selectedDayData.dayEvents.map((event) => {
              const typeInfo = EVENT_TYPES.find((type) => type.id === event.type);
              return (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="w-20 shrink-0 text-sm font-bold text-slate-700">
                      {formatEventTime(event.startTime)}
                    </div>
                    <div className="w-px self-stretch bg-slate-200" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex w-2.5 h-2.5 rounded-full', typeInfo?.bgColor || 'bg-slate-400')} />
                        <p className="text-sm font-semibold text-slate-800 truncate">{event.title}</p>
                      </div>
                       <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                         <span>{typeInfo?.label || event.type}</span>
                         {event.endTime && <span>• {formatEventTime(event.endTime)} bitis</span>}
                         {event.assignedUserName && <span>• {event.assignedUserName}</span>}
                       </div>
                       {event.link && (
                         <a
                           href={event.link}
                           target="_blank"
                           rel="noopener noreferrer"
                           onClick={(clickEvent) => clickEvent.stopPropagation()}
                           className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-600 underline underline-offset-2 hover:text-sky-500"
                         >
                           <Link2 className="h-3.5 w-3.5" />
                           Linke Git
                         </a>
                       )}
                     </div>
                   </div>
                 </div>
              );
            })}

            {selectedDayData.dayEntries.map((entry, index) => (
              <div key={`${selectedTimelineDate}-entry-${index}`} className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Gunluk Not</p>
                <p className="mt-2 text-sm text-slate-700">{entry.note}</p>
              </div>
            ))}

            {selectedDayData.dayEvents.length === 0 && selectedDayData.dayEntries.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3 py-6 text-center text-sm text-slate-400">
                Secili gun icin kayit yok.
              </div>
            )}
          </div>
        </motion.div>
        <motion.div
          variants={scaleIn}
          role="button"
          tabIndex={0}
          aria-label="Statistics sayfasini ac"
          onClick={() => handleCardNavigation('statistics')}
          onKeyDown={(event) => handleCardKeyDown(event, 'statistics')}
          className="flex h-full min-h-[290px] flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-xl hover:shadow-teal-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          <div className="flex items-center justify-between p-6 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tercih Edilen Ulkeler</h3>
            </div>
            <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg uppercase tracking-wider">Country Focus</span>
          </div>
          <div className="h-52 sm:h-56 xl:h-[220px] px-4 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={countryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={92}
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
          <div className="px-6 pb-4 flex flex-wrap content-start justify-center gap-x-4 gap-y-3 text-center">
            {countryData.map((country, index) => (
              <div key={country.name} className="inline-flex items-start justify-center gap-2 min-w-0 max-w-[150px] sm:max-w-[160px] text-slate-800 text-center">
                <span
                  className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p
                    className="text-[11px] sm:text-xs font-medium leading-4 text-slate-700 break-words overflow-hidden text-center [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                    title={`${country.name} (${country.count})`}
                  >
                    {country.name}
                  </p>
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-600 shrink-0 leading-4">{country.count}</span>
              </div>
            ))}
            {countryData.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8 w-full">Ulkeler icin tercih verisi bulunmuyor.</p>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
