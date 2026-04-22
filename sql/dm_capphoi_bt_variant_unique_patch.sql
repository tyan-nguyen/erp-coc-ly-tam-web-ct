-- Fix unique rule for concrete mix variants, but adapt to the real column set
-- in the current DB.
--
-- Business rule:
--   unique by (mac_be_tong + variant + nvl_id)
-- not only by (mac_be_tong + nvl_id)

begin;

alter table public.dm_capphoi_bt
  drop constraint if exists dm_capphoi_bt_mac_be_tong_nvl_id_key;

drop index if exists public.dm_capphoi_bt_mac_be_tong_nvl_id_key;
drop index if exists public.dm_capphoi_bt_mac_be_tong_nvl_id_variant_key;
drop index if exists public.dm_capphoi_bt_unique_variant_active;

do $$
declare
  variant_expr text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dm_capphoi_bt'
      and column_name = 'variant'
  ) then
    variant_expr := 'upper(coalesce(variant, ''FULL_XI_TRO_XI''))';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dm_capphoi_bt'
      and column_name = 'cap_phoi_variant'
  ) then
    variant_expr := 'upper(coalesce(cap_phoi_variant, ''FULL_XI_TRO_XI''))';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dm_capphoi_bt'
      and column_name = 'loai_cap_phoi'
  ) then
    variant_expr := 'upper(coalesce(loai_cap_phoi, ''FULL_XI_TRO_XI''))';
  else
    variant_expr := 'upper(coalesce(nullif(substring(coalesce(ghi_chu, '''') from ''VARIANT:([A-Z0-9_ -]+)''), ''''), ''FULL_XI_TRO_XI''))';
  end if;

  execute format(
    'create unique index if not exists dm_capphoi_bt_unique_variant_active
       on public.dm_capphoi_bt (mac_be_tong, %s, nvl_id)
     where coalesce(is_active, true) = true',
    variant_expr
  );
end $$;

commit;
