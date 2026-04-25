-- DEV only: RLS-safe soft-delete RPC for master-data tables.
-- Run in Supabase SQL Editor.

create or replace function public.soft_delete_master_data(
  p_table_name text,
  p_key_field text,
  p_key_value text,
  p_user_id uuid,
  p_is_active_field text default 'is_active',
  p_deleted_at_field text default 'deleted_at'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sql text;
begin
  if p_table_name not in (
    'dm_ncc',
    'nvl',
    'dm_coc_template',
    'dm_dinh_muc_phu_md',
    'dm_capphoi_bt',
    'dm_kh',
    'dm_duan'
  ) then
    raise exception 'table not allowed for soft delete: %', p_table_name;
  end if;

  if p_deleted_at_field is null or length(trim(p_deleted_at_field)) = 0 then
    sql := format(
      'update public.%I set %I = false, updated_by = $1 where %I::text = $2',
      p_table_name,
      p_is_active_field,
      p_key_field
    );
  else
    sql := format(
      'update public.%I set %I = false, %I = now(), updated_by = $1 where %I::text = $2',
      p_table_name,
      p_is_active_field,
      p_deleted_at_field,
      p_key_field
    );
  end if;

  execute sql using p_user_id, p_key_value;
end;
$$;

grant execute on function public.soft_delete_master_data(text, text, text, uuid, text, text)
to authenticated;
