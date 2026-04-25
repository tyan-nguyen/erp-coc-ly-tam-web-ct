-- DEV patch proposal: allow authenticated soft-delete transition.
-- Apply ONLY if current WITH CHECK is blocking is_active=false updates.
-- Review in SQL Editor before running.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dm_ncc',
    'nvl',
    'dm_coc_template',
    'dm_dinh_muc_phu_md',
    'dm_capphoi_bt'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'p_soft_delete_authenticated', t);

    -- Minimal permissive update policy for authenticated users in DEV.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      'p_soft_delete_authenticated',
      t
    );
  END LOOP;
END $$;

-- Optional rollback example:
-- DROP POLICY IF EXISTS p_soft_delete_authenticated ON public.dm_ncc;
-- DROP POLICY IF EXISTS p_soft_delete_authenticated ON public.nvl;
-- DROP POLICY IF EXISTS p_soft_delete_authenticated ON public.dm_coc_template;
-- DROP POLICY IF EXISTS p_soft_delete_authenticated ON public.dm_dinh_muc_phu_md;
-- DROP POLICY IF EXISTS p_soft_delete_authenticated ON public.dm_capphoi_bt;
