create table goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table channels (
  id text primary key,
  title text not null,
  handle text,
  uploads_playlist_id text not null,
  thumbnail_url text,
  added_at timestamptz not null default now(),
  last_synced_at timestamptz
);

create table videos (
  id text primary key,
  channel_id text not null,
  channel_title text not null,
  title text not null,
  description text not null default '',
  published_at timestamptz,
  duration_seconds integer not null,
  thumbnail_url text,
  fetched_at timestamptz not null default now()
);
create index videos_channel_idx on videos (channel_id);
create index videos_fetched_idx on videos (fetched_at);

create table screenings (
  video_id text primary key references videos (id) on delete cascade,
  goal_id uuid references goals (id) on delete set null,
  score integer not null,
  reason text not null,
  screened_at timestamptz not null default now()
);

create table feed_entries (
  feed_date date not null,
  video_id text not null references videos (id) on delete cascade,
  goal_id uuid not null references goals (id) on delete cascade,
  rank integer not null,
  primary key (feed_date, video_id)
);

create table syllabi (
  video_id text primary key references videos (id) on delete cascade,
  content jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index syllabi_created_idx on syllabi (created_at);
create index screenings_goal_idx on screenings (goal_id);
create index feed_entries_video_idx on feed_entries (video_id);
create index feed_entries_goal_idx on feed_entries (goal_id);

-- Only the server (service role) touches these tables; RLS with no policies locks out the public API keys.
alter table goals enable row level security;
alter table channels enable row level security;
alter table videos enable row level security;
alter table screenings enable row level security;
alter table feed_entries enable row level security;
alter table syllabi enable row level security;
