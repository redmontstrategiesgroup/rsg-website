-- Add founder / cofounder / head_programmer / wholesale_real_estate admin roles alongside the
-- existing ones. Mirrors ADMIN_ROLES in lib/types.ts.
do $$
begin
  if to_regclass('public.admins') is not null then
    alter table public.admins drop constraint if exists admins_role_check;
    alter table public.admins add constraint admins_role_check
      check (role in (
        'owner', 'founder', 'cofounder', 'head_programmer', 'administrator',
        'manager', 'scheduler', 'consultant', 'sales', 'wholesale_real_estate', 'employee',
        'contractor', 'security_reviewer', 'viewer'
      ));
  end if;
end $$;
