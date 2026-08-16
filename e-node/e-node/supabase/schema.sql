-- E-NODE database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "uuid-ossp";

-- ============================================================
-- machines
-- ============================================================
create table if not exists machines (
  id uuid primary key default uuid_generate_v4(),
  machine_id text unique not null,
  name text not null,
  machine_type text,
  location text,
  status text default 'unknown',
  created_at timestamptz default now()
);

-- ============================================================
-- nodes
-- ============================================================
create table if not exists nodes (
  id uuid primary key default uuid_generate_v4(),
  node_id text unique not null,
  machine_id text not null references machines(machine_id) on delete cascade,
  firmware_version text,
  last_seen timestamptz,
  status text default 'offline',
  energy_state text,
  wifi_rssi integer,
  uptime_seconds integer,
  created_at timestamptz default now()
);

-- ============================================================
-- maintenance_logs
-- ============================================================
create table if not exists maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  node_id text not null,
  machine_id text not null,
  vibration_rms double precision not null,
  peak_current double precision not null,
  supercap_voltage double precision not null,
  kurtosis double precision not null,
  z_score double precision not null,
  variance double precision,
  panic boolean not null default false,
  severity text not null default 'info',
  anomaly_detected boolean not null default false,
  trigger_reason text,
  energy_state text
);

create index if not exists idx_logs_created_at on maintenance_logs (created_at desc);
create index if not exists idx_logs_node_id on maintenance_logs (node_id);
create index if not exists idx_logs_machine_id on maintenance_logs (machine_id);
create index if not exists idx_logs_severity on maintenance_logs (severity);

-- ============================================================
-- alerts
-- ============================================================
create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  node_id text not null,
  machine_id text not null,
  severity text not null,
  title text not null,
  message text not null,
  trigger_reason text not null,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz
);

create index if not exists idx_alerts_created_at on alerts (created_at desc);
create index if not exists idx_alerts_node_id on alerts (node_id);
create index if not exists idx_alerts_severity on alerts (severity);
create index if not exists idx_alerts_acknowledged on alerts (acknowledged);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table machines enable row level security;
alter table nodes enable row level security;
alter table maintenance_logs enable row level security;
alter table alerts enable row level security;

-- Authenticated operators can read everything (adjust to your org's needs).
create policy "authenticated read machines" on machines for select using (auth.role() = 'authenticated');
create policy "authenticated read nodes" on nodes for select using (auth.role() = 'authenticated');
create policy "authenticated read logs" on maintenance_logs for select using (auth.role() = 'authenticated');
create policy "authenticated read alerts" on alerts for select using (auth.role() = 'authenticated');

-- Operators may acknowledge alerts.
create policy "authenticated update alerts" on alerts for update using (auth.role() = 'authenticated');

-- Inserts/upserts to logs, nodes, alerts are performed exclusively by the
-- server-side service-role client used in app/api/telemetry/route.ts, which
-- bypasses RLS. No public/anon insert policies are defined intentionally.

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table maintenance_logs;
alter publication supabase_realtime add table nodes;
alter publication supabase_realtime add table alerts;

-- ============================================================
-- Seed the machine + node (replace with your real identifiers)
-- ============================================================
insert into machines (machine_id, name, machine_type, location, status)
values ('MTR-001', 'Industrial Motor', 'Induction Motor', 'Plant Floor A', 'unknown')
on conflict (machine_id) do nothing;

insert into nodes (node_id, machine_id, status)
values ('EN-ESP32C3-001', 'MTR-001', 'offline')
on conflict (node_id) do nothing;
