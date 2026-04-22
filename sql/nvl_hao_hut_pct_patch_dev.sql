alter table public.nvl
  add column if not exists hao_hut_pct numeric(8,2) not null default 0;

update public.nvl
set hao_hut_pct = 0
where hao_hut_pct is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nvl_hao_hut_pct_range_check'
  ) then
    alter table public.nvl
      add constraint nvl_hao_hut_pct_range_check
      check (hao_hut_pct >= 0 and hao_hut_pct <= 100);
  end if;
end $$;
