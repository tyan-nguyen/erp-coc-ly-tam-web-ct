-- DEV fixture for segment-level boc_tach retest
-- Scope:
-- 1) Create/ensure NVL rows for auxiliary materials used by PHC - A500
-- 2) Create/ensure dm_dinh_muc_phu_md rates for D500
-- 3) Create/ensure dm_coc_template row for PHC - A500
-- 4) Create default concrete mix rows in dm_capphoi_bt for mac 60 / M600
--    and mac 80 / M800
--
-- IMPORTANT:
-- - This script is for DEV only.
-- - The auxiliary rates below are taken from the user's validated example.
-- - The concrete mix rates below are the business-approved DEFAULT quotation /
--   forecast mix for FULL_XI_TRO_XI, based on the user's Excel baseline.

begin;

-- ---------------------------------------------------------------------------
-- 1) Ensure NVL master rows
--    Reuse an existing valid nhom_hang value from DEV to avoid guessing enum/check values.
-- ---------------------------------------------------------------------------

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Than da san xuat', 'kg', 'VAT_TU_PHU', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Than da san xuat')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Que han', 'que', 'VAT_TU_PHU', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Que han')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Dau lau khuon', 'lit', 'VAT_TU_PHU', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Dau lau khuon')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Dau DO van hanh', 'lit', 'VAT_TU_PHU', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Dau DO van hanh')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Dien', 'kwh', 'VAT_TU_PHU', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Dien')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Gie lau/bao tay', 'bo', 'VAT_TU_PHU', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Gie lau/bao tay')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Xi mang OPC', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Xi mang OPC')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Xi S75', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Xi S75')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Cat 2.0', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Cat 2.0')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Cat nghien 0x5', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Cat nghien 0x5')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Da 1x2', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Da 1x2')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Da 5x20 LT', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Da 5x20 LT')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Tro bay', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Tro bay')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Nuoc', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Nuoc')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Phu gia 60', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Phu gia 60')
);

insert into public.nvl (ten_hang, dvt, nhom_hang, is_active, deleted_at)
select 'Phu gia 80', 'kg', 'NVL', true, null
where not exists (
  select 1 from public.nvl where upper(ten_hang) = upper('Phu gia 80')
);

-- ---------------------------------------------------------------------------
-- 2) Auxiliary material rates for D500 / PHC - A500
--    Based on validated example:
--    - Than da: 1.5 kg/md
--    - Que han: 0.12 que/md
--    - Dau lau khuon: 0.022 lit/md
--    - Dau DO: 0.028 lit/md
--    - Dien: 0.5 kwh/md
--    - Gie lau/bao tay: 0.04 bo/md
-- ---------------------------------------------------------------------------

with nvl_map as (
  select nvl_id, upper(ten_hang) as ten_hang
  from public.nvl
  where upper(ten_hang) in (
    upper('Than da san xuat'),
    upper('Que han'),
    upper('Dau lau khuon'),
    upper('Dau DO van hanh'),
    upper('Dien'),
    upper('Gie lau/bao tay')
  )
)
insert into public.dm_dinh_muc_phu_md (nvl_id, nhom_d, dvt, dinh_muc, is_active, deleted_at)
select m.nvl_id, '500', vals.dvt, vals.dinh_muc, true, null
from nvl_map m
join (
  values
    (upper('Than da san xuat'), 'kg', 1.5::numeric),
    (upper('Que han'), 'que', 0.12::numeric),
    (upper('Dau lau khuon'), 'lit', 0.022::numeric),
    (upper('Dau DO van hanh'), 'lit', 0.028::numeric),
    (upper('Dien'), 'kwh', 0.5::numeric),
    (upper('Gie lau/bao tay'), 'bo', 0.04::numeric)
) as vals(ten_hang, dvt, dinh_muc)
  on m.ten_hang = vals.ten_hang
where not exists (
  select 1
  from public.dm_dinh_muc_phu_md d
  where d.nvl_id = m.nvl_id
    and upper(coalesce(d.nhom_d, '')) = '500'
    and d.is_active = true
);

-- ---------------------------------------------------------------------------
-- 3) dm_coc_template fixture row for PHC - A500
--    Insert required baseline columns first; then patch optional technical
--    columns only if they exist in the real table.
-- ---------------------------------------------------------------------------

insert into public.dm_coc_template (loai_coc, mac_be_tong, do_ngoai, chieu_day, is_active, deleted_at)
select 'PHC - A500', '80', 500, 100, true, null
where not exists (
  select 1
  from public.dm_coc_template
  where upper(loai_coc) = upper('PHC - A500')
    and coalesce(mac_be_tong, '') = '80'
    and do_ngoai = 500
    and chieu_day = 100
    and is_active = true
);

do $$
declare
  v_template_id uuid;
begin
  select template_id
  into v_template_id
  from public.dm_coc_template
  where upper(loai_coc) = upper('PHC - A500')
    and coalesce(mac_be_tong, '') = '80'
    and do_ngoai = 500
    and chieu_day = 100
    and is_active = true
  order by created_at desc nulls last
  limit 1;

  if v_template_id is null then
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'pc_dia_mm'
  ) then
    execute 'update public.dm_coc_template set pc_dia_mm = 9 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'pc_nos'
  ) then
    execute 'update public.dm_coc_template set pc_nos = 14 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'dai_dia_mm'
  ) then
    execute 'update public.dm_coc_template set dai_dia_mm = 4 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'buoc_dia_mm'
  ) then
    execute 'update public.dm_coc_template set buoc_dia_mm = 1 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'dtam_mm'
  ) then
    execute 'update public.dm_coc_template set dtam_mm = 400 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'a1_mm'
  ) then
    execute 'update public.dm_coc_template set a1_mm = 100 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'a2_mm'
  ) then
    execute 'update public.dm_coc_template set a2_mm = 0 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'a3_mm'
  ) then
    execute 'update public.dm_coc_template set a3_mm = 100 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'p1_pct'
  ) then
    execute 'update public.dm_coc_template set p1_pct = 20 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'p2_pct'
  ) then
    execute 'update public.dm_coc_template set p2_pct = 0 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'p3_pct'
  ) then
    execute 'update public.dm_coc_template set p3_pct = 80 where template_id = $1'
    using v_template_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dm_coc_template' and column_name = 'don_kep_factor'
  ) then
    execute 'update public.dm_coc_template set don_kep_factor = 2 where template_id = $1'
    using v_template_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 4) Default concrete mix rows for quotation / forecast
--    IMPORTANT:
--    - public.dm_capphoi_bt currently has unique (mac_be_tong, nvl_id)
--    - so this table can only hold one default mix per grade/material
--    - for quotation / forecast, use FULL_XI_TRO_XI as the default mix
--    - actual production mix variant will be chosen later in the production flow
--    - deactivate the old placeholder rows first so preview no longer shows
--      generic "Xi mang/Cat/Da/Phu gia cho M800" entries
-- ---------------------------------------------------------------------------

update public.dm_capphoi_bt cp
set is_active = false,
    deleted_at = coalesce(cp.deleted_at, now())
from public.nvl n
where cp.nvl_id = n.nvl_id
  and cp.mac_be_tong in ('60', '80')
  and cp.is_active = true
  and upper(n.ten_hang) in (
    upper('Xi mang cho M800'),
    upper('Cat cho M800'),
    upper('Da cho M800'),
    upper('Phu gia cho M800')
  );

with mix_targets as (
  select nvl_id, ten_hang, dvt
  from public.nvl
  where upper(ten_hang) in (
    upper('Xi mang OPC'),
    upper('Xi S75'),
    upper('Cat 2.0'),
    upper('Cat nghien 0x5'),
    upper('Da 1x2'),
    upper('Da 5x20 LT'),
    upper('Tro bay'),
    upper('Nuoc'),
    upper('Phu gia 60'),
    upper('Phu gia 80')
  )
),
mix_values as (
  select *
  from (
    values
      ('60', 'FULL_XI_TRO_XI', upper('Xi mang OPC'), 'kg', 310::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Xi S75'), 'kg', 92.5::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Tro bay'), 'kg', 47::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Cat 2.0'), 'kg', 585::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Cat nghien 0x5'), 'kg', 293::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Da 1x2'), 'kg', 1467::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Nuoc'), 'kg', 64.5::numeric),
      ('60', 'FULL_XI_TRO_XI', upper('Phu gia 60'), 'kg', 4.4::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Xi mang OPC'), 'kg', 352::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Xi S75'), 'kg', 88::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Tro bay'), 'kg', 70.2::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Cat 2.0'), 'kg', 597::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Cat nghien 0x5'), 'kg', 292.5::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Da 5x20 LT'), 'kg', 1468::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Nuoc'), 'kg', 70.2::numeric),
      ('80', 'FULL_XI_TRO_XI', upper('Phu gia 80'), 'kg', 5::numeric)
  ) as v(mac_be_tong, variant, ten_hang, dvt, dinh_muc_m3)
)
insert into public.dm_capphoi_bt (nvl_id, mac_be_tong, dinh_muc_m3, dvt, ghi_chu, is_active, deleted_at)
select
  t.nvl_id,
  mv.mac_be_tong,
  mv.dinh_muc_m3,
  mv.dvt,
  'FIXTURE_DEFAULT_MIX; VARIANT:' || mv.variant,
  true,
  null
from mix_targets t
join mix_values mv on upper(t.ten_hang) = mv.ten_hang
where not exists (
  select 1
  from public.dm_capphoi_bt cp
  where cp.nvl_id = t.nvl_id
    and cp.mac_be_tong = mv.mac_be_tong
    and cp.is_active = true
);

commit;

-- ---------------------------------------------------------------------------
-- Verify after running
-- ---------------------------------------------------------------------------

-- select template_id, loai_coc, mac_be_tong, do_ngoai, chieu_day, is_active
-- from public.dm_coc_template
-- where upper(loai_coc) = upper('PHC - A500');

-- select d.dm_id, n.ten_hang, d.nhom_d, d.dinh_muc, d.dvt, d.is_active
-- from public.dm_dinh_muc_phu_md d
-- join public.nvl n on n.nvl_id = d.nvl_id
-- where upper(d.nhom_d) = '500'
-- order by n.ten_hang;

-- select cp.cp_id, n.ten_hang, cp.mac_be_tong, cp.dinh_muc_m3, cp.dvt, cp.ghi_chu, cp.is_active
-- from public.dm_capphoi_bt cp
-- join public.nvl n on n.nvl_id = cp.nvl_id
-- where cp.mac_be_tong in ('60', '80')
-- order by cp.mac_be_tong, cp.ghi_chu, n.ten_hang;
