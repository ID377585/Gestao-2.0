alter table public.sales_price_benchmarks
  add column if not exists restaurant_1_name text,
  add column if not exists restaurant_2_name text,
  add column if not exists restaurant_3_name text,
  add column if not exists restaurant_4_name text,
  add column if not exists restaurant_5_name text;
