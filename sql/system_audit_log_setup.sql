create extension if not exists pgcrypto;

create table if not exists public.system_audit_log (
  log_id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text null,
  entity_code text null,
  actor_id uuid null,
  actor_role text null,
  actor_email text null,
  before_json jsonb null,
  after_json jsonb null,
  summary_json jsonb not null default '{}'::jsonb,
  note text null,
  request_path text null,
  created_at timestamptz not null default now()
);

create index if not exists system_audit_log_created_at_idx
  on public.system_audit_log (created_at desc);

create index if not exists system_audit_log_entity_idx
  on public.system_audit_log (entity_type, entity_id, created_at desc);

create index if not exists system_audit_log_actor_idx
  on public.system_audit_log (actor_id, created_at desc);

create index if not exists system_audit_log_action_idx
  on public.system_audit_log (action, created_at desc);

alter table public.system_audit_log enable row level security;

grant select, insert on public.system_audit_log to authenticated;

drop policy if exists system_audit_log_insert_authenticated on public.system_audit_log;
create policy system_audit_log_insert_authenticated on public.system_audit_log
for insert to authenticated
with check (true);

drop policy if exists system_audit_log_admin_select on public.system_audit_log;
create policy system_audit_log_admin_select on public.system_audit_log
for select to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.user_id = auth.uid()
      and up.is_active = true
      and lower(coalesce(up.role, '')) = 'admin'
  )
);
