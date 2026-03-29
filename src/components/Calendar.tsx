import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Video, CalendarClock, Users, BookOpen, Presentation, Link2 } from 'lucide-react';
import { Student, SystemUser, UserRole } from '../types';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export type EventType = 'toplanti' | 'webinar' | 'randevu' | 'egitim' | 'seminer';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  type: EventType;
  note?: string;
  link?: string;
  createdBy?: string;
  assignedUserId?: string;
  assignedUserName?: string;
}

export interface CalendarEntry {
  date: string;
  type: 'webinar' | 'randevu' | 'etkinlik';
  note: string;
}

export const EVENT_TYPES: { id: EventType; label: string; icon: any; color: string; bgColor: string }[] = [
  { id: 'toplanti', label: 'Toplanti', icon: Users, color: 'text-orange-500', bgColor: 'bg-orange-500' },
  { id: 'webinar', label: 'Webinar', icon: Video, color: 'text-blue-500', bgColor: 'bg-blue-500' },
  { id: 'randevu', label: 'Randevu', icon: CalendarClock, color: 'text-purple-500', bgColor: 'bg-purple-500' },
  { id: 'egitim', label: 'Eğitim', icon: BookOpen, color: 'text-green-500', bgColor: 'bg-green-500' },
  { id: 'seminer', label: 'Seminer', icon: Presentation, color: 'text-pink-500', bgColor: 'bg-pink-500' },
];

export const DAY_OFF_CONFIG = {
  mondayOff: true,
  sundayOff: true,
};

const HOLIDAYS = [
  { date: '2026-01-01', name: 'Yılbaşı' },
];

const isHoliday = (dateKey: string, year: number, month: number): { isHoliday: boolean; name?: string } => {
  if (dateKey === '2026-01-01') {
    return { isHoliday: true, name: 'Yılbaşı' };
  }
  
  const date = new Date(dateKey);
  if (date.getDay() === 0) {
    return { isHoliday: true, name: 'Pazar' };
  }
  return { isHoliday: false };
};

const validateUrl = (url: string): { valid: boolean; message?: string } => {
  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    return { valid: true };
  }

  try {
    const candidateUrl = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;
    const urlObj = new URL(candidateUrl);

    if (['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: true };
    }
    return { valid: false, message: 'Geçerli bir URL giriniz (http/https)' };
  } catch {
    return { valid: false, message: 'Geçerli bir URL formatı giriniz' };
  }
};

const validateTimeRange = (startTime: string, endTime: string): { valid: boolean; message?: string } => {
  if (!startTime) {
    return { valid: false, message: 'Başlangıç saati zorunludur' };
  }
  if (endTime && startTime >= endTime) {
    return { valid: false, message: 'Bitiş saati başlangıç saatinden sonra olmalıdır' };
  }
  return { valid: true };
};

export const formatEventTime = (time?: string) => {
  if (!time) {
    return '';
  }

  const trimmedTime = time.trim();
  const match = trimmedTime.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return trimmedTime;
  }

  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

interface CalendarProps {
  students: Student[];
  users: SystemUser[];
  entries: CalendarEntry[];
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onDeleteEvent: (eventId: string) => void;
  variant?: 'full' | 'compact';
  selectedDate?: string | null;
  onSelectedDateChange?: (date: string | null) => void;
}

const Calendar: React.FC<CalendarProps> = ({ students, users, entries, events, onAddEvent, onDeleteEvent, variant = 'full', selectedDate: controlledSelectedDate, onSelectedDateChange }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalDate, setExternalDate] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('randevu');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableUsers = useMemo(
    () => users.filter((user) => user.isActive && user.role !== UserRole.STUDENT),
    [users]
  );

  const timeOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`),
    []
  );

  const endTimeOptions = useMemo(() => {
    if (!eventStartTime) {
      return timeOptions;
    }

    return timeOptions.filter((time) => time > eventStartTime);
  }, [eventStartTime, timeOptions]);

  useEffect(() => {
    if (eventEndTime && eventStartTime && eventEndTime <= eventStartTime) {
      setEventEndTime('');
    }
  }, [eventEndTime, eventStartTime]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDateKey = formatLocalDateKey(today);
  const selectedDate = controlledSelectedDate ?? null;

  const updateSelectedDate = (date: string | null) => {
    onSelectedDateChange?.(date);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const adjustedStartDay = startingDay === 0 ? 6 : startingDay - 1;

    const days: (number | null)[] = [];
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const formatDateKey = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  const getStudentCountForDay = (day: number) => {
    const dateKey = formatDateKey(day);
    return students.filter(s => s.reminderDate === dateKey).length;
  };

  const getEntriesForDay = (day: number): CalendarEntry[] => {
    const dateKey = formatDateKey(day);
    return entries.filter(e => e.date === dateKey);
  };

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const dateKey = formatDateKey(day);
    return events.filter(e => e.date === dateKey);
  };

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const days = getDaysInMonth(currentDate);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const nextDate = new Date();
    nextDate.setHours(0, 0, 0, 0);
    setCurrentDate(nextDate);
    updateSelectedDate(formatLocalDateKey(nextDate));
  };

  const handleDayClick = (day: number) => {
    const dateKey = formatDateKey(day);
    updateSelectedDate(dateKey);
    setErrors({});
  };

  const closeModal = () => {
    updateSelectedDate(null);
    setEventTitle('');
    setEventType('randevu');
    setEventStartTime('');
    setEventEndTime('');
    setEventLink('');
    setAssignedUserId('');
    setErrors({});
  };

  const handleAddEvent = () => {
    const newErrors: Record<string, string> = {};
    
    if (!eventTitle.trim()) {
      newErrors.title = 'Etkinlik başlığı zorunludur';
    }
    
    if (!eventStartTime) {
      newErrors.startTime = 'Başlangıç saati zorunludur';
    }

    const timeValidation = validateTimeRange(eventStartTime, eventEndTime);
    if (!timeValidation.valid) {
      newErrors.endTime = timeValidation.message;
    }
    
    const urlValidation = validateUrl(eventLink);
    if (!urlValidation.valid) {
      newErrors.link = urlValidation.message;
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const assignedUser = availableUsers.find((user) => user.id === assignedUserId);

    const newEvent: Omit<CalendarEvent, 'id'> = {
      title: eventTitle.trim(),
      date: selectedDate!,
      startTime: eventStartTime,
      endTime: eventEndTime || undefined,
      type: eventType,
      link: eventLink.trim() || undefined,
      assignedUserId: assignedUser?.id,
      assignedUserName: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : undefined,
    };
    
    onAddEvent(newEvent);
    closeModal();
  };

  const isCompact = variant === 'compact';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return (
    <div className={cn("bg-slate-800 rounded-xl", isCompact ? "p-3" : "p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Önceki ay"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <span className="text-sm font-semibold text-white">
            {`${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Sonraki ay"
          >
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors bg-slate-700 text-slate-200 hover:bg-slate-600"
          >
            Bugün
          </button>
        </div>
      </div>

      <>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className={cn("text-center font-medium text-slate-500 py-1", isCompact ? "text-[9px]" : "text-[10px]")}>
                {day}
              </div>
            ))}
          </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateKey = formatDateKey(day);
          const studentCount = getStudentCountForDay(day);
          const dayEntries = getEntriesForDay(day);
          const dayEvents = getEventsForDay(day);
          const holidayInfo = isHoliday(dateKey, year, month);
          const isToday = dateKey === todayDateKey;
          const isSelected = dateKey === selectedDate;
          const isHolidayDay = holidayInfo.isHoliday;

          const totalItemCount = dayEvents.length + dayEntries.length;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative",
                isSelected
                  ? 'ring-2 ring-cyan-300 bg-cyan-500/20 text-white font-bold'
                  : isToday
                  ? 'bg-indigo-600 text-white font-bold'
                  : isHolidayDay
                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              )}
              aria-label={`${day} ${monthNames[month]}, ${studentCount} öğrenci, ${totalItemCount} etkinlik`}
            >
              <span>{day}</span>
              {(studentCount > 0 || totalItemCount > 0) && (
                <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                  {totalItemCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500 text-[9px] flex items-center justify-center text-white font-bold min-w-[20px] text-center" title={`${totalItemCount} etkinlik`}>
                      {totalItemCount}
                    </span>
                  )}
                  {studentCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] flex items-center justify-center text-white font-bold min-w-[20px] text-center" title="Öğrenci hatırlatması">
                      {studentCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      </>

      {!isCompact && (
        <div className="flex items-center gap-3 mt-4 text-[10px] text-slate-400 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Öğrenci Sayısı</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Etkinlik</span>
          </div>
        </div>
      )}

      {!isCompact && (
        <div className="mt-4">
          {!showExternalForm ? (
            <button
              onClick={() => {
                setShowExternalForm(true);
                setExternalDate(selectedDate || new Date().toISOString().split('T')[0]);
                setErrors({});
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Etkinlik Oluştur
            </button>
          ) : (
            <div className="bg-slate-700/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-medium text-sm">Etkinlik Oluştur</h4>
                <button
                  onClick={() => {
                    setShowExternalForm(false);
                    setExternalDate('');
                  }}
                  className="p-1 hover:bg-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tarih *</label>
                  <input
                    type="date"
                    value={externalDate}
                    onChange={e => setExternalDate(e.target.value)}
                    className="w-full bg-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Başlık *</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder="Etkinlik başlığı"
                    className="w-full bg-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tür *</label>
                <div className="grid grid-cols-5 gap-1">
                  {EVENT_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setEventType(type.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all",
                          eventType === type.id
                            ? `${type.bgColor} text-white`
                            : "bg-slate-600 text-slate-400 hover:bg-slate-500"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px]">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Başlangıç Saati *</label>
                  <select
                    value={eventStartTime}
                    onChange={e => {
                      setEventStartTime(e.target.value);
                      setErrors(prev => ({ ...prev, startTime: '', endTime: '' }));
                    }}
                    className="w-full bg-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seçin</option>
                    {timeOptions.map((time) => {
                      return (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bitiş Saati</label>
                  <select
                    value={eventEndTime}
                    onChange={e => {
                      setEventEndTime(e.target.value);
                      setErrors(prev => ({ ...prev, endTime: '' }));
                    }}
                    className="w-full bg-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seçin</option>
                    {endTimeOptions.map((time) => {
                      return (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Atanan Kullanıcı</label>
                <select
                  value={assignedUserId}
                  onChange={e => {
                    setAssignedUserId(e.target.value);
                  }}
                  className="w-full bg-slate-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Kullanıcı seçin</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {`${user.firstName} ${user.lastName} - ${user.role}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Link</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    value={eventLink}
                    onChange={e => setEventLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-600 text-white text-sm rounded-lg pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowExternalForm(false);
                    setExternalDate('');
                    setErrors({});
                    setEventTitle('');
                    setEventStartTime('');
                    setEventEndTime('');
                    setEventLink('');
                    setEventType('randevu');
                    setAssignedUserId('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-500 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    const nextErrors: Record<string, string> = {};
                    if (!externalDate) {
                      nextErrors.date = 'Tarih zorunludur';
                    }
                    if (!eventTitle) {
                      nextErrors.title = 'Başlık zorunludur';
                    }
                    if (!eventStartTime) {
                      nextErrors.startTime = 'Saat zorunludur';
                    }
                    const timeValidation = validateTimeRange(eventStartTime, eventEndTime);
                    if (!timeValidation.valid) {
                      nextErrors.endTime = timeValidation.message || '';
                    }
                    const urlValidation = validateUrl(eventLink);
                    if (!urlValidation.valid) {
                      nextErrors.link = urlValidation.message || '';
                    }
                    if (Object.keys(nextErrors).length > 0) {
                      setErrors(nextErrors);
                      return;
                    }
                    const assignedUser = availableUsers.find((user) => user.id === assignedUserId);
                      const normalizedLink = eventLink.trim()
                        ? (/^https?:\/\//i.test(eventLink.trim()) ? eventLink.trim() : `https://${eventLink.trim()}`)
                        : undefined;

                      const newEvent: Omit<CalendarEvent, 'id'> = {
                        title: eventTitle,
                        date: externalDate,
                        startTime: eventStartTime,
                        endTime: eventEndTime || undefined,
                        type: eventType,
                        link: normalizedLink,
                        assignedUserId: assignedUser?.id,
                        assignedUserName: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : undefined,
                      };
                    onAddEvent(newEvent);
                    setErrors({});
                    setShowExternalForm(false);
                    setExternalDate('');
                    setEventTitle('');
                    setEventStartTime('');
                    setEventEndTime('');
                    setEventLink('');
                    setEventType('randevu');
                    setAssignedUserId('');
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Ekle
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export { Calendar };
