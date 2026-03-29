import React, { useState, useEffect } from 'react';
import { Calendar, CalendarEntry, CalendarEvent, EVENT_TYPES, formatEventTime } from '../components/Calendar';
import { Student, SystemUser } from '../types';
import { studentService } from '../services/studentService';
import { calendarService } from '../services/calendarService';
import { MOCK_USERS } from '../services/mockData';
import { motion } from 'framer-motion';
import { Link2, Palmtree, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const STORAGE_ENTRIES_KEY = 'unic_calendar_entries';
const STORAGE_EVENTS_KEY = 'unic_calendar_events';
const LEGACY_EVENT_ID_PREFIX = 'event-';

const persistEvents = (events: CalendarEvent[]) => {
  localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
};

const clearLegacyCalendarStorage = () => {
  localStorage.removeItem(STORAGE_ENTRIES_KEY);
  localStorage.removeItem(STORAGE_EVENTS_KEY);
};

const hasLegacyLocalCalendarData = () => {
  try {
    const storedEvents = localStorage.getItem(STORAGE_EVENTS_KEY);
    const storedEntries = localStorage.getItem(STORAGE_ENTRIES_KEY);

    if (storedEntries) {
      const parsedEntries = JSON.parse(storedEntries);
      if (Array.isArray(parsedEntries) && parsedEntries.length > 0) {
        return true;
      }
    }

    if (storedEvents) {
      const parsedEvents = JSON.parse(storedEvents);
      if (
        Array.isArray(parsedEvents) &&
        parsedEvents.some((event) => typeof event?.id === 'string' && event.id.startsWith(LEGACY_EVENT_ID_PREFIX))
      ) {
        return true;
      }
    }
  } catch {
    return true;
  }

  return false;
};

const CalendarPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [users] = useState<SystemUser[]>(MOCK_USERS);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => new Date().toISOString().split('T')[0]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const studentData = await studentService.getAll();
      setStudents(studentData);

      const remoteCalendar = await calendarService.getAll();
      let nextEntries = remoteCalendar.entries;
      let nextEvents = remoteCalendar.events;

      if (nextEntries.length === 0 && nextEvents.length === 0 && hasLegacyLocalCalendarData()) {
        clearLegacyCalendarStorage();
      }

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

      persistEvents(nextEvents);

      setCalendarEntries(nextEntries);
      setCalendarEvents(nextEvents);

      setLoading(false);
    };
    loadData();
  }, []);

  const handleAddCalendarEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    const normalizedEvent: CalendarEvent = {
      ...event,
      id: '',
      link: event.link?.trim() || undefined,
    };

    try {
      const persistedEvent = await calendarService.createEvent(normalizedEvent);

      setCalendarEvents((prev) => {
        const updated = [...prev, persistedEvent];
        persistEvents(updated);
        return updated;
      });
    } catch (error) {
      console.error('Failed to persist calendar event to Supabase', error);
    }
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    setCalendarEvents(prev => {
      const updated = prev.filter(e => e.id !== eventId);
      persistEvents(updated);
      return updated;
    });

    try {
      await calendarService.deleteEvent(eventId);
    } catch (error) {
      console.error('Failed to delete calendar event from Supabase', error);
    }
  };

  const handleUpdateCalendarEvent = async (updatedEvent: CalendarEvent) => {
    setCalendarEvents((prev) => {
      const updated = prev.map((event) => event.id === updatedEvent.id ? updatedEvent : event);
      persistEvents(updated);
      return updated;
    });

    try {
      await calendarService.updateEvent(updatedEvent);
    } catch (error) {
      console.error('Failed to update calendar event in Supabase', error);
    }
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
          Takvim yükleniyor...
        </motion.p>
      </div>
    );
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const selectedEntries = selectedDate ? calendarEntries.filter(e => e.date === selectedDate) : [];
  const selectedEvents = selectedDate ? calendarEvents.filter(e => e.date === selectedDate) : [];
  const selectedStudentCount = selectedDate ? students.filter(s => s.reminderDate === selectedDate).length : 0;
  const selectedDateObj = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;
  const isSelectedToday = selectedDate === todayStr;

  const renderEventDetails = (events: CalendarEvent[]) => (
    <div className="space-y-3">
      {events
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((event) => {
          const typeInfo = EVENT_TYPES.find((type) => type.id === event.type);
          const TypeIcon = typeInfo?.icon;
          const formattedStartTime = formatEventTime(event.startTime);
          const formattedEndTime = formatEventTime(event.endTime);
          const timeLabel = formattedEndTime ? `${formattedStartTime} - ${formattedEndTime}` : formattedStartTime;
          const isEditing = editingEventId === event.id;

          return (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-36 shrink-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span>{timeLabel}</span>
                  </div>
                </div>
                <div className="w-px self-stretch bg-slate-200" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {TypeIcon && <TypeIcon className={cn('h-4 w-4 shrink-0', typeInfo?.color || 'text-slate-500')} />}
                        <span className="text-xs font-semibold text-slate-500">{typeInfo?.label || event.type}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">{event.title}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingEventId(isEditing ? null : event.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Etkinligi duzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCalendarEvent(event.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Etkinligi sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {event.assignedUserName && <span>• {event.assignedUserName}</span>}
                  </div>
                  {event.link && (
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Linke Git
                    </a>
                  )}
                  {isEditing && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          value={event.title}
                          onChange={(e) => handleUpdateCalendarEvent({ ...event, title: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <select
                          value={event.type}
                          onChange={(e) => handleUpdateCalendarEvent({ ...event, type: e.target.value as CalendarEvent['type'] })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {EVENT_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>{type.label}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={event.startTime}
                          onChange={(e) => handleUpdateCalendarEvent({ ...event, startTime: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                          type="time"
                          value={event.endTime || ''}
                          onChange={(e) => handleUpdateCalendarEvent({ ...event, endTime: e.target.value || undefined })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <select
                          value={event.assignedUserId || ''}
                          onChange={(e) => {
                            const selectedUser = users.find((user) => user.id === e.target.value);
                            handleUpdateCalendarEvent({
                              ...event,
                              assignedUserId: e.target.value || undefined,
                              assignedUserName: selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : undefined,
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Atanan kullanıcı seçin</option>
                          {users
                            .filter((user) => user.isActive && user.role !== 'Student')
                            .map((user) => (
                              <option key={user.id} value={user.id}>
                                {`${user.firstName} ${user.lastName} - ${user.role}`}
                              </option>
                            ))}
                        </select>
                        <input
                          type="url"
                          value={event.link || ''}
                          onChange={(e) => handleUpdateCalendarEvent({ ...event, link: e.target.value || undefined })}
                          placeholder="https://..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Takvim
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Webinar, Randevu, Etkinlik ve Ajanda takibi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Calendar
          students={students}
          users={users}
          entries={calendarEntries}
          events={calendarEvents}
          onAddEvent={handleAddCalendarEvent}
          onDeleteEvent={handleDeleteCalendarEvent}
          variant="full"
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
        />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn('p-2 rounded-xl', isSelectedToday ? 'bg-indigo-50' : 'bg-cyan-50')}>
              <Palmtree className={cn('w-4 h-4', isSelectedToday ? 'text-indigo-600' : 'text-cyan-600')} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">
                {selectedDateObj?.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {isSelectedToday && <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">Bugün</p>}
            </div>
          </div>

          <div className="space-y-3">
            {selectedStudentCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">CRM Öğrenci Sayısı</span>
                </div>
                <span className="text-lg font-bold text-slate-800">{selectedStudentCount}</span>
              </div>
            )}
            {selectedEvents.length > 0 && renderEventDetails(selectedEvents)}
            {selectedEntries.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm text-slate-600">Randevu/Not</span>
                </div>
                <span className="text-lg font-bold text-slate-800">{selectedEntries.length}</span>
              </div>
            )}
            {selectedStudentCount === 0 && selectedEvents.length === 0 && selectedEntries.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">
                Seçili gün için kayıt bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CalendarPage;
