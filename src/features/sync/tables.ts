/**
 * Which local tables/columns are synced. Columns not listed here stay local:
 * `dirty`, `meetings.reminder_notification_id`, and the whole `settings` table.
 * Must match supabase/migrations (server adds user_id + server_updated_at).
 */
export type SyncTable = {
  name: string;
  columns: string[];
  /** Stored as JSON text locally, jsonb on the server */
  json: string[];
};

const BASE = ['id', 'created_at', 'updated_at', 'deleted_at'];

export const SYNC_TABLES: SyncTable[] = [
  {
    name: 'tasks',
    columns: [...BASE, 'title', 'notes', 'quadrant', 'due_at', 'status', 'completed_at', 'source', 'meeting_id'],
    json: [],
  },
  {
    name: 'meetings',
    columns: [
      ...BASE,
      'title',
      'start_at',
      'end_at',
      'location',
      'participants',
      'agenda',
      'status',
      'source',
      'reminder_offset_min',
    ],
    json: ['participants'],
  },
  {
    name: 'minutes',
    columns: [...BASE, 'meeting_id', 'discussion', 'decisions', 'attendees', 'action_items', 'attachments'],
    json: ['attendees', 'action_items', 'attachments'],
  },
  {
    name: 'timer_presets',
    columns: [...BASE, 'kind', 'name', 'duration_sec', 'sort_order'],
    json: [],
  },
  {
    name: 'timer_sessions',
    columns: [...BASE, 'kind', 'planned_sec', 'started_at', 'ended_at', 'completed', 'actual_sec', 'preset_id'],
    json: [],
  },
];

export const SYNC_TABLE_NAMES = new Set(SYNC_TABLES.map((t) => t.name));
