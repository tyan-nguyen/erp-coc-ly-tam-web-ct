-- Report rows that still cannot be grouped/displayed by ma_coc.
-- Run in Supabase SQL Editor after pile_serial_setup.sql.

select
  'unmapped_stock_by_loai_coc' as section,
  ps.loai_coc,
  count(*) as serial_count,
  count(distinct ps.ten_doan || '|' || ps.chieu_dai_m::text) as item_variant_count,
  count(distinct nullif(ps.ma_coc, '')) as mapped_code_count
from public.pile_serial ps
where ps.is_active = true
  and coalesce(ps.ma_coc, '') = ''
group by ps.loai_coc
order by serial_count desc, ps.loai_coc;

select
  'uuid_stock_by_loai_coc' as section,
  ps.loai_coc,
  count(*) as serial_count,
  count(distinct ps.ma_coc) as uuid_code_count,
  string_agg(distinct ps.ma_coc, ' | ' order by ps.ma_coc) as uuid_codes
from public.pile_serial ps
where ps.is_active = true
  and ps.ma_coc ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
group by ps.loai_coc
order by serial_count desc, ps.loai_coc;

select
  'template_candidates_by_loai_coc' as section,
  t.loai_coc,
  count(*) as template_count,
  string_agg(coalesce(to_jsonb(t)->>'ma_coc', to_jsonb(t)->>'ma_coc_template', t.template_id::text), ' | ' order by coalesce(to_jsonb(t)->>'ma_coc', to_jsonb(t)->>'ma_coc_template', t.template_id::text)) as ma_coc_candidates
from public.dm_coc_template t
where t.is_active = true
group by t.loai_coc
order by t.loai_coc;

with template_code_source as (
  select
    t.template_id,
    t.loai_coc,
    regexp_replace(upper(trim(coalesce(to_jsonb(t)->>'mac_be_tong', ''))), '^M', '') as mac_be_tong,
    upper(trim(coalesce(to_jsonb(t)->>'mac_thep', substring(coalesce(t.loai_coc, '') from '-\\s*([ABC])\\d+'), ''))) as mac_thep,
    trim(coalesce(to_jsonb(t)->>'do_ngoai', substring(coalesce(t.loai_coc, '') from '[ABC](\\d+)'))) as do_ngoai,
    trim(coalesce(to_jsonb(t)->>'chieu_day', substring(coalesce(t.loai_coc, '') from '-\\s*[ABC]\\d+\\s*-\\s*(\\d+(?:\\.\\d+)?)'))) as chieu_day,
    coalesce(to_jsonb(t)->>'ma_coc', to_jsonb(t)->>'ma_coc_template') as current_ma_coc
  from public.dm_coc_template t
  where t.is_active = true
),
ranked_template_code as (
  select
    loai_coc,
    current_ma_coc,
    'M' || mac_be_tong || ' - ' || mac_thep || do_ngoai || ' - ' || chieu_day || ' - ' ||
      row_number() over (
        partition by mac_be_tong, mac_thep, do_ngoai, chieu_day
        order by template_id::text
      )::text as generated_ma_coc
  from template_code_source
  where mac_be_tong <> '' and mac_thep <> '' and do_ngoai <> '' and chieu_day <> ''
)
select
  'generated_template_codes' as section,
  loai_coc,
  count(*) as template_count,
  string_agg(
    coalesce(nullif(current_ma_coc, ''), '(blank)') || ' => ' || generated_ma_coc,
    ' | '
    order by generated_ma_coc
  ) as ma_coc_candidates
from ranked_template_code
group by loai_coc
order by loai_coc;
