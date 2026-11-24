-- Adaylar now also come from Keşif araması and manual Arama, not only Kaynak kanallar.
alter table videos add column source text not null default 'channel' check (source in ('channel', 'discovery', 'search'));

-- Keşif araması runs once a day per Hedef; last queries are kept so the next day searches something new.
alter table goals add column discovery_queries text[] not null default '{}';
alter table goals add column discovered_at timestamptz;
