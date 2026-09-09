-- The application stores the lower adjustment cap as a signed amount because
-- it is applied with Math.max(negative_cap, raw_adjustment).
alter table public.calculation_settings
  drop constraint if exists calculation_settings_negative_cap_check;

alter table public.calculation_settings
  add constraint calculation_settings_negative_cap_check
  check (negative_cap between -10000 and 0);
