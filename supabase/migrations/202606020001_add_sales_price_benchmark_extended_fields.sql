alter table public.sales_price_benchmarks
  add column if not exists x_factor numeric(12, 4),
  add column if not exists calculated_sale_price numeric(12, 2),
  add column if not exists defined_sale_price numeric(12, 2),
  add column if not exists percent_vs_lowest_competitor numeric(12, 4),
  add column if not exists lowest_competitor_markup numeric(12, 4),
  add column if not exists markup_difference numeric(12, 4);

comment on column public.sales_price_benchmarks.x_factor is 'Markup informado no campo X do cadastro de Preço Venda Médio.';
comment on column public.sales_price_benchmarks.calculated_sale_price is 'Preço Venda calculado por preço de custo x X.';
comment on column public.sales_price_benchmarks.defined_sale_price is 'Nosso preço definido informado manualmente.';
comment on column public.sales_price_benchmarks.percent_vs_lowest_competitor is 'Diferença percentual entre nosso preço definido e o menor concorrente.';
comment on column public.sales_price_benchmarks.lowest_competitor_markup is 'Markup do menor concorrente usando nosso custo como base.';
comment on column public.sales_price_benchmarks.markup_difference is 'Diferença entre markup do menor concorrente e nosso markup X.';
