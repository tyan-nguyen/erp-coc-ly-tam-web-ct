-- Chuyen danh muc coc mau sang nhan dien bang ma_coc.
-- Cho phep nhieu mau cung loai/cuong do/duong kinh/thanh coc neu khac ma_coc/phu kien/dinh muc.

do $$
begin
  if to_regclass('public.dm_coc_template') is null then
    return;
  end if;

  alter table public.dm_coc_template add column if not exists ma_coc text null;
  alter table public.dm_coc_template add column if not exists is_active boolean not null default true;
  alter table public.dm_coc_template add column if not exists deleted_at timestamptz null;

  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'dm_coc_template'
      and constraint_name = 'dm_coc_template_loai_coc_do_ngoai_chieu_day_key'
  ) then
    alter table public.dm_coc_template
      drop constraint dm_coc_template_loai_coc_do_ngoai_chieu_day_key;
  end if;

  drop index if exists public.dm_coc_template_loai_coc_do_ngoai_chieu_day_key;
  drop index if exists public.dm_coc_template_loai_coc_do_ngoai_chieu_day_active_key;
end $$;

create unique index if not exists dm_coc_template_ma_coc_active_unique
  on public.dm_coc_template (ma_coc)
  where coalesce(ma_coc, '') <> ''
    and coalesce(is_active, true) = true
    and deleted_at is null;
