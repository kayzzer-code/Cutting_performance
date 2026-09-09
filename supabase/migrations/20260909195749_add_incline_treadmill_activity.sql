alter table public.activities
  add column speed_kmh numeric(5,2),
  add column incline_percent numeric(5,2);

alter table public.activities
  add constraint activities_speed_kmh_check
    check (speed_kmh is null or speed_kmh > 0 and speed_kmh <= 12),
  add constraint activities_incline_percent_check
    check (incline_percent is null or incline_percent between 0 and 40);

alter table public.activities drop constraint activities_type_check;

alter table public.activities
  add constraint activities_type_check
    check (type in ('running', 'cycling', 'jump-rope', 'rowing', 'elliptical', 'stair-climber', 'incline-treadmill', 'other'));
