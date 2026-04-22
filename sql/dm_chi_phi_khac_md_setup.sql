begin;

create table if not exists public.dm_chi_phi_khac_md (
  cost_id uuid primary key default gen_random_uuid(),
  item_name text not null,
  dvt text not null default 'vnd/md',
  duong_kinh_mm numeric not null,
  chi_phi_vnd_md numeric not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists dm_chi_phi_khac_md_lookup_idx
  on public.dm_chi_phi_khac_md (duong_kinh_mm, sort_order);

create index if not exists dm_chi_phi_khac_md_active_idx
  on public.dm_chi_phi_khac_md (is_active, deleted_at);

commit;
