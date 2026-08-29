from pathlib import Path

client_path = Path("src/app/(dashboard)/estoque/catalogo/CatalogoClient.tsx")
print_path = Path("src/app/(dashboard)/estoque/catalogo/CatalogPrintPages.tsx")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


client = client_path.read_text(encoding="utf-8")

client = replace_once(
    client,
    "  Camera,\n  ImagePlus,",
    "  Camera,\n  Check,\n  CheckSquare2,\n  ImagePlus,",
    "icon imports start",
)
client = replace_once(
    client,
    "  Upload,\n} from \"lucide-react\";",
    "  Upload,\n  X,\n} from \"lucide-react\";",
    "icon imports end",
)
client = replace_once(
    client,
    'import { CatalogPrintPages } from "./CatalogPrintPages";\n',
    'import { CatalogPrintPages } from "./CatalogPrintPages";\nimport { CatalogSelectionPrintPages } from "./CatalogSelectionPrintPages";\n',
    "selection print import",
)
client = replace_once(
    client,
    "  const [deleting, setDeleting] = useState<string | null>(null);\n",
    "  const [deleting, setDeleting] = useState<string | null>(null);\n  const [selectionMode, setSelectionMode] = useState(false);\n  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());\n",
    "selection state",
)
client = replace_once(
    client,
    '''  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const visibleItems = useMemo(() => {''',
    '''  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    const clearPrintMode = () => {
      document.documentElement.removeAttribute("data-catalog-print-mode");
    };
    window.addEventListener("afterprint", clearPrintMode);
    return () => {
      window.removeEventListener("afterprint", clearPrintMode);
      clearPrintMode();
    };
  }, []);

  const visibleItems = useMemo(() => {''',
    "afterprint cleanup",
)
client = replace_once(
    client,
    '''  }, [category, items, query, sort]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);''',
    '''  }, [category, items, query, sort]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);''',
    "selected items derivation",
)
client = replace_once(
    client,
    '''  async function submit(event: FormEvent<HTMLFormElement>) {''',
    '''  function startSelection() {
    setSelectedIds(new Set());
    setSelectionMode(true);
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(itemId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectVisibleItems() {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleItems.forEach((item) => next.add(item.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function printCatalog(mode: "all" | "selection") {
    if (mode === "selection" && !selectedItems.length) {
      toast.error("Selecione pelo menos um item para imprimir.");
      return;
    }
    document.documentElement.dataset.catalogPrintMode = mode;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {''',
    "selection helpers",
)
client = replace_once(
    client,
    '''      setItems((current) => current.filter((row) => row.id !== item.id));
      toast.success("Item excluído do catálogo.");''',
    '''      setItems((current) => current.filter((row) => row.id !== item.id));
      setSelectedIds((current) => {
        if (!current.has(item.id)) return current;
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      toast.success("Item excluído do catálogo.");''',
    "remove deleted selection",
)
client = replace_once(
    client,
    '''          actions={
            <>
              <Button type="button" variant="outline" onClick={() => window.print()} disabled={!items.length}>
                <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
              </Button>
              <Button type="button" onClick={createItem}><Plus className="h-4 w-4" /> Novo item</Button>
            </>
          }''',
    '''          actions={
            selectionMode ? (
              <>
                <Button type="button" variant="outline" onClick={cancelSelection}>
                  <X className="h-4 w-4" /> Cancelar seleção
                </Button>
                <Button
                  type="button"
                  onClick={() => printCatalog("selection")}
                  disabled={!selectedItems.length}
                >
                  <Printer className="h-4 w-4" /> Imprimir Seleção ({selectedItems.length})
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={startSelection} disabled={!items.length}>
                  <CheckSquare2 className="h-4 w-4" /> Seleção
                </Button>
                <Button type="button" variant="outline" onClick={() => printCatalog("all")} disabled={!items.length}>
                  <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
                </Button>
                <Button type="button" onClick={createItem}><Plus className="h-4 w-4" /> Novo item</Button>
              </>
            )
          }''',
    "header actions",
)
client = replace_once(
    client,
    '''      {visibleItems.length ? (
        <section className="catalog-no-print catalog-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">''',
    '''      {selectionMode ? (
        <Card className="catalog-no-print border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-blue-950 dark:text-blue-100">Seleção de itens</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {selectedItems.length} {selectedItems.length === 1 ? "item selecionado" : "itens selecionados"}. Toque nos cards para adicionar ou remover.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={selectVisibleItems} disabled={!visibleItems.length}>
                <CheckSquare2 className="h-4 w-4" /> Selecionar visíveis
              </Button>
              <Button type="button" variant="ghost" onClick={clearSelection} disabled={!selectedItems.length}>
                Limpar
              </Button>
              <Button type="button" onClick={() => printCatalog("selection")} disabled={!selectedItems.length}>
                <Printer className="h-4 w-4" /> Imprimir Seleção
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {visibleItems.length ? (
        <section className="catalog-no-print catalog-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">''',
    "selection toolbar",
)
client = replace_once(
    client,
    '''            <Card key={item.id} className="catalog-card group overflow-hidden bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-950">''',
    '''            <Card
              key={item.id}
              role={selectionMode ? "checkbox" : undefined}
              aria-checked={selectionMode ? selectedIds.has(item.id) : undefined}
              aria-label={selectionMode ? `${selectedIds.has(item.id) ? "Remover" : "Selecionar"} ${item.name}` : undefined}
              tabIndex={selectionMode ? 0 : undefined}
              onClick={selectionMode ? () => toggleSelected(item.id) : undefined}
              onKeyDown={selectionMode ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSelected(item.id);
                }
              } : undefined}
              className={`catalog-card group overflow-hidden bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-950 ${selectionMode ? "cursor-pointer select-none ring-offset-2 dark:ring-offset-slate-950" : ""} ${selectedIds.has(item.id) ? "ring-2 ring-blue-500 shadow-lg" : ""}`}
            >''',
    "selectable card",
)
client = replace_once(
    client,
    '''                <div className="catalog-no-print absolute right-3 top-3 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button type="button" size="icon" variant="secondary" className="h-8 w-8 bg-white/95" onClick={() => editItem(item)} aria-label={`Editar ${item.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8" disabled={deleting === item.id} onClick={() => void removeItem(item)} aria-label={`Excluir ${item.name}`}>{deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                </div>''',
    '''                {selectionMode ? (
                  <div
                    className={`catalog-no-print absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-sm transition ${selectedIds.has(item.id) ? "border-blue-600 bg-blue-600 text-white" : "border-white bg-white/95 text-transparent"}`}
                    aria-hidden="true"
                  >
                    <Check className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="catalog-no-print absolute right-3 top-3 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button type="button" size="icon" variant="secondary" className="h-8 w-8 bg-white/95" onClick={() => editItem(item)} aria-label={`Editar ${item.name}`}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="destructive" className="h-8 w-8" disabled={deleting === item.id} onClick={() => void removeItem(item)} aria-label={`Excluir ${item.name}`}>{deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                  </div>
                )}''',
    "selection indicator",
)
client = replace_once(
    client,
    '''      <CatalogPrintPages establishmentName={establishmentName} generatedLabel={generatedLabel} items={visibleItems} />

      <div className="hidden catalog-no-print">''',
    '''      <CatalogPrintPages establishmentName={establishmentName} generatedLabel={generatedLabel} items={visibleItems} />
      <CatalogSelectionPrintPages items={selectedItems} />

      <div className="hidden catalog-no-print">''',
    "selection print component",
)

client_path.write_text(client, encoding="utf-8")

print_pages = print_path.read_text(encoding="utf-8")
print_pages = replace_once(
    print_pages,
    '<div className="catalog-print-pages" aria-hidden="true">',
    '<div className="catalog-print-pages catalog-print-pages-all" aria-hidden="true">',
    "all print wrapper",
)
print_pages = replace_once(
    print_pages,
    '''        @media print{
          html,body{''',
    '''        @media print{
          html[data-catalog-print-mode="selection"] .catalog-print-pages-all{display:none!important}
          html,body{''',
    "hide all print during selection",
)
print_path.write_text(print_pages, encoding="utf-8")
