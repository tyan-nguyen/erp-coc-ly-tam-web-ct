-- DEV patch: align public.nvl.nhom_hang with app/UI values
-- Target groups:
--   THEP
--   NVL
--   VAT_TU_PHU
--   PHU_KIEN
--   TAI_SAN
--   CONG_CU_DUNG_CU

begin;

alter table public.nvl
  drop constraint if exists nvl_nhom_hang_check;

-- Normalize known auxiliary-consumption rows to VAT_TU_PHU
update public.nvl
set nhom_hang = 'VAT_TU_PHU'
where upper(coalesce(ten_hang, '')) in (
  'THAN DA SAN XUAT',
  'QUE HAN',
  'DAU LAU KHUON',
  'DAU DO VAN HANH',
  'DIEN',
  'GIE LAU/BAO TAY'
);

-- Normalize concrete-mix raw materials to NVL
update public.nvl
set nhom_hang = 'NVL'
where upper(coalesce(ten_hang, '')) in (
  'XI MANG OPC',
  'XI S75',
  'CAT 2.0',
  'CAT NGHIEN 0X5',
  'DA 1X2',
  'DA 5X20 LT',
  'TRO BAY',
  'NUOC',
  'PHU GIA 60',
  'PHU GIA 80'
);

-- Normalize known steel rows to THEP
update public.nvl
set nhom_hang = 'THEP'
where upper(coalesce(ten_hang, '')) like 'TH%C PC %'
   or upper(coalesce(ten_hang, '')) like 'THEP PC %'
   or upper(coalesce(ten_hang, '')) like 'TH%C DAI %'
   or upper(coalesce(ten_hang, '')) like 'THEP DAI %'
   or upper(coalesce(ten_hang, '')) like 'TH%C BUOC %'
   or upper(coalesce(ten_hang, '')) like 'THEP BUOC %';

-- Normalize known accessories to PHU_KIEN
update public.nvl
set nhom_hang = 'PHU_KIEN'
where upper(coalesce(ten_hang, '')) like 'MAT BICH %'
   or upper(coalesce(ten_hang, '')) like 'M%T B%CH %'
   or upper(coalesce(ten_hang, '')) like 'MANG XONG %'
   or upper(coalesce(ten_hang, '')) like 'M%NG X%NG %'
   or upper(coalesce(ten_hang, '')) like 'MUI COC ROI %'
   or upper(coalesce(ten_hang, '')) like 'M%I C%C R%I %'
   or upper(coalesce(ten_hang, '')) like 'MUI COC LIEN %'
   or upper(coalesce(ten_hang, '')) like 'M%I C%C LI%N %'
   or upper(coalesce(ten_hang, '')) like 'TAM VUONG %'
   or upper(coalesce(ten_hang, '')) like 'T%M VU%NG %';

-- Normalize remaining variants/aliases to the 3 canonical groups
update public.nvl
set nhom_hang = 'PHU_KIEN'
where upper(coalesce(nhom_hang, '')) in ('PHU KIEN', 'PHUKIEN', 'PHU-KIEN');

update public.nvl
set nhom_hang = 'THEP'
where upper(coalesce(nhom_hang, '')) in ('THÉP', 'STEEL');

update public.nvl
set nhom_hang = 'NVL'
where upper(coalesce(nhom_hang, '')) in (
  'NGUYEN VAT LIEU',
  'NGUYÊN VẬT LIỆU',
  'VAT TU PHU',
  'VẬT TƯ PHỤ',
  'VAT_TU_PHU',
  'VAT TU',
  'VAT TU',
  'MATERIAL'
);

update public.nvl
set nhom_hang = 'VAT_TU_PHU'
where upper(coalesce(nhom_hang, '')) in ('VATTU_PHU', 'VAT-TU-PHU', 'VAT TU PHU', 'VATTUPHU');

-- Final fallback: any remaining unknown/non-empty value becomes NVL in DEV
update public.nvl
set nhom_hang = 'NVL'
where coalesce(nullif(trim(nhom_hang), ''), '') <> ''
  and upper(nhom_hang) not in ('THEP', 'NVL', 'VAT_TU_PHU', 'PHU_KIEN', 'TAI_SAN', 'CONG_CU_DUNG_CU');

alter table public.nvl
  add constraint nvl_nhom_hang_check
  check (
    upper(nhom_hang) = any (
      array[
        'THEP'::text,
        'NVL'::text,
        'VAT_TU_PHU'::text,
        'PHU_KIEN'::text,
        'TAI_SAN'::text,
        'CONG_CU_DUNG_CU'::text
      ]
    )
  );

commit;

-- Verify
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'nvl_nhom_hang_check';

select nhom_hang, count(*) as so_luong
from public.nvl
group by nhom_hang
order by nhom_hang;
