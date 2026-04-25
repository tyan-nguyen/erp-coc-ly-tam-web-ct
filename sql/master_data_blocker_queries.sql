-- 1) dm_kh check expression
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'dm_kh_nhom_kh_check';

-- 2) Update/soft-delete policies for blocker tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'dm_ncc',
    'nvl',
    'dm_coc_template',
    'dm_dinh_muc_phu_md',
    'dm_capphoi_bt'
  )
ORDER BY tablename, policyname;

-- 3) Optional: quickly inspect trigger-based behavior around soft-delete
SELECT event_object_table AS table_name,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'dm_ncc',
    'nvl',
    'dm_coc_template',
    'dm_dinh_muc_phu_md',
    'dm_capphoi_bt'
  )
ORDER BY table_name, trigger_name;
