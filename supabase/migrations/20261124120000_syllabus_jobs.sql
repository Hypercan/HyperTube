-- Derin analiz runs in the background; this row is what the video page polls.
create table syllabus_jobs (
  video_id text primary key references videos (id) on delete cascade,
  status text not null check (status in ('running', 'failed')),
  error text,
  detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table syllabus_jobs enable row level security;
