import { CalendarEntry, CalendarEvent } from '../components/Calendar';
import { supabase } from './supabaseClient';

type CalendarRecordType = 'entry' | 'event';

interface CalendarRecordRow {
  id: string;
  record_type: CalendarRecordType;
  date: string;
  title: string | null;
  entry_type: CalendarEntry['type'] | null;
  event_type: CalendarEvent['type'] | null;
  note: string | null;
  start_time: string | null;
  end_time: string | null;
  link: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  created_by: string | null;
  created_at?: string;
}

const mapRowToCalendarEntry = (row: CalendarRecordRow): CalendarEntry => ({
  date: row.date,
  type: (row.entry_type || 'etkinlik') as CalendarEntry['type'],
  note: row.note || '',
});

const mapRowToCalendarEvent = (row: CalendarRecordRow): CalendarEvent => ({
  id: row.id,
  title: row.title || '',
  date: row.date,
  startTime: row.start_time || '',
  endTime: row.end_time || undefined,
  type: (row.event_type || 'webinar') as CalendarEvent['type'],
  note: row.note || undefined,
  link: row.link || undefined,
  createdBy: row.created_by || undefined,
  assignedUserId: row.assigned_user_id || undefined,
  assignedUserName: row.assigned_user_name || undefined,
});

export const calendarService = {
  async getAll(): Promise<{ entries: CalendarEntry[]; events: CalendarEvent[] }> {
    if (!supabase) {
      return { entries: [], events: [] };
    }

    try {
      const { data, error } = await supabase
        .from('calendar_list')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase fetch calendar_list failed. Falling back to local cache.', error.message);
        return { entries: [], events: [] };
      }

      const rows = (data || []) as CalendarRecordRow[];

      return {
        entries: rows.filter((row) => row.record_type === 'entry').map(mapRowToCalendarEntry),
        events: rows.filter((row) => row.record_type === 'event').map(mapRowToCalendarEvent),
      };
    } catch (error) {
      console.warn('Unexpected error in calendarService.getAll. Falling back to local cache.', error);
      return { entries: [], events: [] };
    }
  },

  async createEntry(entry: CalendarEntry): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from('calendar_list').insert({
      record_type: 'entry',
      date: entry.date,
      entry_type: entry.type,
      note: entry.note,
    });

    if (error) {
      throw new Error(error.message || 'Calendar entry insert failed');
    }
  },

  async createEvent(event: CalendarEvent): Promise<CalendarEvent> {
    if (!supabase) {
      return event;
    }

    const { data, error } = await supabase
      .from('calendar_list')
      .insert({
        record_type: 'event',
        date: event.date,
        title: event.title,
        event_type: event.type,
        note: event.note || null,
        start_time: event.startTime,
        end_time: event.endTime || null,
        link: event.link || null,
        assigned_user_id: event.assignedUserId || null,
        assigned_user_name: event.assignedUserName || null,
        created_by: event.createdBy || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || 'Calendar event insert failed');
    }

    return mapRowToCalendarEvent(data as CalendarRecordRow);
  },

  async deleteEvent(eventId: string): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from('calendar_list')
      .delete()
      .eq('id', eventId)
      .eq('record_type', 'event');

    if (error) {
      throw new Error(error.message || 'Calendar event delete failed');
    }
  },

  async updateEvent(event: CalendarEvent): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from('calendar_list')
      .update({
        date: event.date,
        title: event.title,
        event_type: event.type,
        note: null,
        start_time: event.startTime,
        end_time: event.endTime || null,
        link: event.link || null,
        assigned_user_id: event.assignedUserId || null,
        assigned_user_name: event.assignedUserName || null,
        created_by: event.createdBy || null,
      })
      .eq('id', event.id)
      .eq('record_type', 'event');

    if (error) {
      throw new Error(error.message || 'Calendar event update failed');
    }
  },
};
