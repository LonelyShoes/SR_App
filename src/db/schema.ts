import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  notes: text('notes'),
  quadrant: text('quadrant').notNull(), // 'Q1'|'Q2'|'Q3'|'Q4'
  due_at: integer('due_at'),
  status: text('status').notNull().default('todo'), // 'todo'|'done'
  completed_at: integer('completed_at'),
  source: text('source').notNull().default('manual'), // 'manual'|'voice'
  meeting_id: text('meeting_id'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  dirty: integer('dirty').notNull().default(1),
});

export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  start_at: integer('start_at').notNull(),
  end_at: integer('end_at').notNull(),
  location: text('location'),
  participants: text('participants', { mode: 'json' }), // JSON array string
  agenda: text('agenda'),
  status: text('status').notNull().default('rencana'), // 'rencana'|'terkonfirmasi'|'selesai'|'batal'
  source: text('source').notNull().default('manual'), // 'manual'|'voice'
  reminder_offset_min: integer('reminder_offset_min'),
  reminder_notification_id: text('reminder_notification_id'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  dirty: integer('dirty').notNull().default(1),
});

export const minutes = sqliteTable('minutes', {
  id: text('id').primaryKey(),
  meeting_id: text('meeting_id').notNull(),
  discussion: text('discussion'),
  decisions: text('decisions'),
  attendees: text('attendees', { mode: 'json' }), // JSON array
  action_items: text('action_items', { mode: 'json' }), // JSON array
  attachments: text('attachments', { mode: 'json' }), // JSON array
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  dirty: integer('dirty').notNull().default(1),
});

export const timer_presets = sqliteTable('timer_presets', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // 'fokus'|'rehat'|'santai'
  name: text('name').notNull(),
  duration_sec: integer('duration_sec').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  dirty: integer('dirty').notNull().default(1),
});

export const timer_sessions = sqliteTable('timer_sessions', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  planned_sec: integer('planned_sec').notNull(),
  started_at: integer('started_at').notNull(),
  ended_at: integer('ended_at').notNull(),
  completed: integer('completed').notNull().default(0),
  actual_sec: integer('actual_sec').notNull(),
  preset_id: text('preset_id'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
  deleted_at: integer('deleted_at'),
  dirty: integer('dirty').notNull().default(1),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: integer('updated_at').notNull(),
});
