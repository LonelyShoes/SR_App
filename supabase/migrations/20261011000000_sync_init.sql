-- SR App: skema sinkronisasi (jalankan sekali di Supabase → SQL Editor)
--
-- Tabel sama dengan SQLite lokal + kolom user_id dan server_updated_at.
-- * Primary key (user_id, id): id dibuat di klien, jadi unik per pengguna.
-- * updated_at (epoch ms, jam perangkat) = penentu "perubahan terakhir menang".
-- * server_updated_at (jam server) = kursor pull, supaya baris dari perangkat
--   lain yang jamnya tertinggal tidak terlewat.
-- * Tidak di-sync: meetings.reminder_notification_id, kolom dirty, tabel settings.

create table if not exists public.tasks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  notes text,
  quadrant text not null,
  due_at bigint,
  status text not null default 'todo',
  completed_at bigint,
  source text not null default 'manual',
  meeting_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.meetings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  start_at bigint not null,
  end_at bigint not null,
  location text,
  participants jsonb,
  agenda text,
  status text not null default 'rencana',
  source text not null default 'manual',
  reminder_offset_min integer,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.minutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  meeting_id text not null,
  discussion text,
  decisions text,
  attendees jsonb,
  action_items jsonb,
  attachments jsonb, -- hanya metadata; file belum diunggah (TODO Storage)
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.timer_presets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  kind text not null,
  name text not null,
  duration_sec integer not null,
  sort_order integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.timer_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  kind text not null,
  planned_sec integer not null,
  started_at bigint not null,
  ended_at bigint not null,
  completed integer not null default 0,
  actual_sec integer not null,
  preset_id text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Last-write-wins di server: tolak update yang lebih lama dari baris tersimpan,
-- dan cap server_updated_at untuk setiap perubahan yang diterima.
create or replace function public.sync_lww_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- abaikan perubahan basi; klien membaca balik versi server
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'meetings', 'minutes', 'timer_presets', 'timer_sessions'] loop
    execute format('drop trigger if exists sync_lww_guard on public.%I', t);
    execute format(
      'create trigger sync_lww_guard before insert or update on public.%I
         for each row execute function public.sync_lww_guard()', t);

    -- Kursor pull: (server_updated_at, id) per pengguna
    execute format(
      'create index if not exists %I on public.%I (user_id, server_updated_at, id)',
      t || '_pull_idx', t);

    -- RLS wajib: setiap pengguna hanya bisa mengakses barisnya sendiri
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
