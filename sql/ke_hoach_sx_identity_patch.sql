alter table public.ke_hoach_sx_line
  add column if not exists template_id uuid null;

alter table public.ke_hoach_sx_line
  add column if not exists ma_coc text null;

create index if not exists ke_hoach_sx_line_template_idx
  on public.ke_hoach_sx_line(template_id);

create index if not exists ke_hoach_sx_line_ma_coc_idx
  on public.ke_hoach_sx_line(ma_coc);
