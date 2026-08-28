"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Boxes,
  Camera,
  ImagePlus,
  Layers3,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CatalogItem = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  quantity: number;
  unit_label: string;
  item_condition: string;
  location: string | null;
  description: string | null;
  photo_path: string | null;
  photo_file_name: string | null;
  photo_mime_type: string | null;
  photo_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  establishmentName: string;
  generatedAt: string;
  initialItems: CatalogItem[];
  initialLoadError: string | null;
};

type FormState = {
  name: string;
  brand: string;
  model: string;
  category: string;
  quantity: string;
  unitLabel: string;
  condition: string;
  location: string;
  description: string;
};

const CATEGORIES = [
  "Utensílios",
  "Louças",
  "Talheres",
  "Equipamentos",
  "Eletrodomésticos",
  "Mobiliário",
  "Enxoval",
  "Outros",
] as const;
const CONDITIONS = ["Novo", "Ótimo", "Bom", "Regular", "Danificado", "Em manutenção"] as const;
const UNITS = ["un.", "jogo", "kit", "caixa", "dúzia", "par"] as const;
const EMPTY_FORM: FormState = {
  name: "",
  brand: "",
  model: "",
  category: "Utensílios",
  quantity: "1",
  unitLabel: "un.",
  condition: "Bom",
  location: "",
  description: "",
};
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2.4 * 1024 * 1024;
const MAX_DIMENSION = 1800;

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function photoUrl(item: CatalogItem) {
  if (!item.photo_path) return null;
  const params = new URLSearchParams({ path: item.photo_path, v: item.updated_at });
  return `/api/estoque/catalogo/foto?${params.toString()}`;
}

function safePhotoName(name: string) {
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "foto-catalogo"}.jpg`;
}

function loadImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a foto."));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível processar a foto."))),
      "image/jpeg",
      quality
    );
  });
}

async function preparePhoto(file: File) {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("A foto original é maior que 25 MB.");

  const isHeic = /\.(heic|heif)$/i.test(file.name) || ["image/heic", "image/heif"].includes(file.type);
  let source: Blob = file;
  if (isHeic) {
    const heic2any = (await import("heic2any")).default as unknown as (options: {
      blob: Blob;
      toType: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    source = Array.isArray(converted) ? converted[0] : converted;
  }

  const image = await loadImage(source);
  let scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  let lastBlob: Blob | null = null;

  for (let round = 0; round < 3; round += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não conseguiu preparar a foto.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54]) {
      const blob = await canvasBlob(canvas, quality);
      lastBlob = blob;
      if (blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], safePhotoName(file.name), { type: "image/jpeg", lastModified: Date.now() });
      }
    }
    scale *= 0.82;
  }

  if (!lastBlob || lastBlob.size > 3 * 1024 * 1024) {
    throw new Error("Não foi possível reduzir a foto para o tamanho permitido.");
  }
  return new File([lastBlob], safePhotoName(file.name), { type: "image/jpeg", lastModified: Date.now() });
}

function conditionClass(value: string) {
  if (["Novo", "Ótimo"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "Regular") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "Danificado") return "border-red-200 bg-red-50 text-red-700";
  if (value === "Em manutenção") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function ItemPhoto({ item, preview }: { item?: CatalogItem; preview?: string | null }) {
  const src = preview ?? (item ? photoUrl(item) : null);
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <ImagePlus className="h-12 w-12" aria-hidden="true" />
      </div>
    );
  }
  return <Image src={src} alt={item ? `Foto de ${item.name}` : "Pré-visualização da foto"} fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />;
}

export function CatalogoClient({ establishmentName, generatedAt, initialItems, initialLoadError }: Props) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState<"name" | "quantity" | "recent">("name");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const visibleItems = useMemo(() => {
    const needle = normalized(query);
    const result = items.filter((item) => {
      if (category !== "Todas" && item.category !== category) return false;
      if (!needle) return true;
      return normalized([item.name, item.brand, item.model, item.category, item.location, item.description].filter(Boolean).join(" ")).includes(needle);
    });
    return result.sort((a, b) => {
      if (sort === "quantity") return b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR");
      if (sort === "recent") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [category, items, query, sort]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const generatedLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(generatedAt));

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function clearEditor() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPhoto(null);
    setPreview(null);
    setRemovePhoto(false);
    setProcessingPhoto(false);
  }

  function createItem() {
    clearEditor();
    setOpen(true);
  }

  function editItem(item: CatalogItem) {
    setEditing(item);
    setForm({
      name: item.name,
      brand: item.brand ?? "",
      model: item.model ?? "",
      category: item.category,
      quantity: String(item.quantity),
      unitLabel: item.unit_label,
      condition: item.item_condition,
      location: item.location ?? "",
      description: item.description ?? "",
    });
    setPhoto(null);
    setPreview(photoUrl(item));
    setRemovePhoto(false);
    setOpen(true);
  }

  function changeOpen(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (!next) clearEditor();
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setProcessingPhoto(true);
    try {
      const ready = await preparePhoto(selected);
      setPhoto(ready);
      setPreview(URL.createObjectURL(ready));
      setRemovePhoto(false);
      toast.success("Foto preparada para o catálogo.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar a foto.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!editing && !photo) return toast.error("Selecione uma foto para cadastrar o item.");
    if (!Number.isInteger(quantity) || quantity < 0) return toast.error("Informe uma quantidade inteira igual ou maior que zero.");

    setSaving(true);
    try {
      const body = new FormData();
      if (editing) body.set("id", editing.id);
      body.set("name", form.name);
      body.set("brand", form.brand);
      body.set("model", form.model);
      body.set("category", form.category);
      body.set("quantity", String(quantity));
      body.set("unit_label", form.unitLabel);
      body.set("item_condition", form.condition);
      body.set("location", form.location);
      body.set("description", form.description);
      body.set("remove_photo", removePhoto ? "true" : "false");
      if (photo) body.set("photo", photo, photo.name);

      const response = await fetch("/api/estoque/catalogo", {
        method: editing ? "PATCH" : "POST",
        body,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      const payload = (await response.json()) as { item?: CatalogItem; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error ?? "Não foi possível salvar o item.");

      setItems((current) =>
        editing ? current.map((item) => (item.id === payload.item!.id ? payload.item! : item)) : [payload.item!, ...current]
      );
      toast.success(editing ? "Item atualizado no catálogo." : "Item cadastrado no catálogo.");
      setOpen(false);
      clearEditor();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o item.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: CatalogItem) {
    if (!window.confirm(`Excluir “${item.name}” do catálogo? A foto também será removida.`)) return;
    setDeleting(item.id);
    try {
      const response = await fetch("/api/estoque/catalogo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ id: item.id }),
      });
      const payload = (await response.json()) as { deleted?: boolean; error?: string };
      if (!response.ok || !payload.deleted) throw new Error(payload.error ?? "Não foi possível excluir o item.");
      setItems((current) => current.filter((row) => row.id !== item.id));
      toast.success("Item excluído do catálogo.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o item.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="catalog-print-root space-y-6">
      <div className="catalog-print-header">
        <div>
          <p className="text-[9pt] font-semibold uppercase tracking-[0.16em] text-slate-500">Gestify · Estoque</p>
          <h1 className="mt-1 text-[20pt] font-bold text-slate-950">Catálogo de utensílios e equipamentos</h1>
          <p className="mt-1 text-[10pt] text-slate-600">{establishmentName} · Gerado em {generatedLabel}</p>
        </div>
        <div className="text-[9pt] text-slate-600">{visibleItems.length} itens · {visibleItems.reduce((sum, item) => sum + item.quantity, 0)} unidades</div>
      </div>

      <div className="catalog-no-print">
        <DashboardPageHeader
          eyebrow="Estoque"
          title="Catálogo"
          description="Cadastre utensílios, louças, talheres e equipamentos em um catálogo visual por empresa, com fotos, quantidades e impressão em A4/PDF."
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => window.print()} disabled={!items.length}>
                <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
              </Button>
              <Button type="button" onClick={createItem}><Plus className="h-4 w-4" /> Novo item</Button>
            </>
          }
        />
      </div>

      {initialLoadError ? <Card className="catalog-no-print border-red-200 bg-red-50"><CardContent className="py-4 text-sm text-red-700">{initialLoadError}</CardContent></Card> : null}

      <section className="catalog-no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [BookOpen, items.length, "Itens cadastrados", "text-blue-600 bg-blue-50"],
          [Boxes, totalQuantity, "Quantidade total", "text-emerald-600 bg-emerald-50"],
          [Layers3, new Set(items.map((item) => item.category)).size, "Categorias", "text-violet-600 bg-violet-50"],
          [Camera, items.filter((item) => item.photo_path).length, "Itens com foto", "text-cyan-600 bg-cyan-50"],
        ].map(([Icon, value, label, classes]) => {
          const SummaryIcon = Icon as typeof BookOpen;
          return (
            <Card key={String(label)}><CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-xl p-3 ${classes}`}><SummaryIcon className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-slate-950 dark:text-slate-100">{String(value)}</p><p className="text-xs text-muted-foreground">{String(label)}</p></div>
            </CardContent></Card>
          );
        })}
      </section>

      <Card className="catalog-no-print"><CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_220px_190px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, marca, modelo ou local..." className="pl-9" /></div>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option>Todas</option>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="name">Nome (A–Z)</option><option value="quantity">Maior quantidade</option><option value="recent">Atualizados recentemente</option></select>
      </CardContent></Card>

      {visibleItems.length ? (
        <section className="catalog-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleItems.map((item) => (
            <Card key={item.id} className="catalog-card group overflow-hidden bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-950">
              <div className="catalog-card-image relative aspect-[4/3] overflow-hidden"><ItemPhoto item={item} /><Badge className="absolute left-3 top-3 border border-white/70 bg-white/90 text-slate-700 shadow-sm">{item.category}</Badge>
                <div className="catalog-no-print absolute right-3 top-3 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                  <Button type="button" size="icon" variant="secondary" className="h-8 w-8 bg-white/95" onClick={() => editItem(item)} aria-label={`Editar ${item.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8" disabled={deleting === item.id} onClick={() => void removeItem(item)} aria-label={`Excluir ${item.name}`}>{deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                </div>
              </div>
              <CardHeader className="catalog-card-header space-y-2 p-4 pb-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="catalog-card-title text-base leading-snug">{item.name}</CardTitle>{item.brand || item.model ? <CardDescription className="mt-1">{[item.brand, item.model].filter(Boolean).join(" · ")}</CardDescription> : null}</div><Badge variant="outline" className={`catalog-condition shrink-0 ${conditionClass(item.item_condition)}`}>{item.item_condition}</Badge></div></CardHeader>
              <CardContent className="catalog-card-content space-y-3 p-4 pt-2">
                <p className="catalog-description line-clamp-2 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-300">{item.description || "Sem observações adicionais."}</p>
                <div className="flex items-end justify-between gap-3 border-t pt-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Em estoque</p><p className="catalog-quantity text-2xl font-bold leading-none text-blue-700">{item.quantity} <span className="text-sm text-slate-500">{item.unit_label}</span></p></div>{item.location ? <div className="flex max-w-[48%] items-center justify-end gap-1 text-right text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{item.location}</div> : null}</div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="catalog-no-print border-dashed"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center"><div className="rounded-full bg-blue-50 p-5 text-blue-600"><Package className="h-10 w-10" /></div><div><h2 className="text-lg font-semibold">{items.length ? "Nenhum item encontrado" : "Seu catálogo ainda está vazio"}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{items.length ? "Altere a busca ou os filtros." : "Cadastre o primeiro utensílio, louça ou equipamento usando as fotos que você já preparou."}</p></div>{!items.length ? <Button onClick={createItem}><Plus className="h-4 w-4" /> Cadastrar primeiro item</Button> : null}</CardContent></Card>
      )}

      <div className="catalog-print-footer">Gestify · {establishmentName} · {visibleItems.length} itens impressos</div>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="catalog-no-print max-h-[94vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? "Editar item do catálogo" : "Cadastrar item no catálogo"}</DialogTitle><DialogDescription>Inclua uma foto nítida e os dados que facilitam a identificação e a contagem.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[250px_minmax(0,1fr)]">
              <div className="space-y-3"><Label>Foto do item {!editing ? "*" : ""}</Label><div className="relative aspect-square overflow-hidden rounded-2xl border border-dashed bg-slate-50"><ItemPhoto preview={preview} />{processingPhoto ? <div className="absolute inset-0 flex items-center justify-center bg-white/80"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div> : null}</div>
                <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={choosePhoto} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={choosePhoto} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" className="w-full" disabled={processingPhoto || saving} onClick={() => galleryInputRef.current?.click()}><Upload className="h-4 w-4" />{preview ? "Trocar pela galeria" : "Escolher da galeria"}</Button>
                  <Button type="button" variant="outline" className="w-full" disabled={processingPhoto || saving} onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4" />{preview ? "Tirar nova foto" : "Tirar foto"}</Button>
                </div>
                {preview ? <Button type="button" variant="ghost" className="w-full text-red-600" disabled={saving} onClick={() => { setPhoto(null); setPreview(null); setRemovePhoto(true); }}><Trash2 className="h-4 w-4" /> Remover foto</Button> : null}
                <p className="text-xs leading-5 text-muted-foreground">No celular, escolha uma imagem da galeria ou tire uma nova foto. JPG, PNG, WebP ou HEIC; a imagem é otimizada automaticamente.</p>
              </div>
              <div className="space-y-4">
                <Field label="Nome do produto *"><Input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Ex.: Panela Grano aço inox 18 cm" maxLength={180} required autoFocus /></Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Marca"><Input value={form.brand} onChange={(event) => setField("brand", event.target.value)} placeholder="Ex.: Tramontina" maxLength={120} /></Field><Field label="Modelo / medida"><Input value={form.model} onChange={(event) => setField("model", event.target.value)} placeholder="Ex.: 18 cm · 2,20 L" maxLength={120} /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Categoria *"><select value={form.category} onChange={(event) => setField("category", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Condição *"><select value={form.condition} onChange={(event) => setField("condition", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{CONDITIONS.map((value) => <option key={value}>{value}</option>)}</select></Field></div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]"><Field label="Quantidade em estoque *"><Input type="number" min={0} max={1_000_000} step={1} inputMode="numeric" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} required /></Field><Field label="Unidade *"><select value={form.unitLabel} onChange={(event) => setField("unitLabel", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{UNITS.map((value) => <option key={value}>{value}</option>)}</select></Field></div>
                <Field label="Localização"><Input value={form.location} onChange={(event) => setField("location", event.target.value)} placeholder="Ex.: Cozinha quente · Prateleira 2" maxLength={160} /></Field>
                <Field label="Descrição / observações"><Textarea value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Material, capacidade, características, uso ou observações importantes..." maxLength={2000} rows={4} /></Field>
              </div>
            </div>
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => changeOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving || processingPhoto}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editing ? "Salvar alterações" : "Cadastrar item"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .catalog-print-header,.catalog-print-footer{display:none}
        @media print{
          @page{size:A4 portrait;margin:9mm}
          html,body{background:#fff!important}
          body *{visibility:hidden!important}
          .catalog-print-root,.catalog-print-root *{visibility:visible!important}
          .catalog-print-root{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;margin:0!important;padding:0!important;color:#0f172a!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
          .catalog-no-print{display:none!important}
          .catalog-print-header{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:8mm!important;margin-bottom:6mm!important;padding-bottom:4mm!important;border-bottom:1px solid #cbd5e1!important}
          .catalog-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4.5mm!important}
          .catalog-card{break-inside:avoid!important;page-break-inside:avoid!important;overflow:hidden!important;border:1px solid #cbd5e1!important;border-radius:3mm!important;background:#fff!important;box-shadow:none!important;transform:none!important}
          .catalog-card-image{height:43mm!important;aspect-ratio:auto!important;background:#f1f5f9!important}
          .catalog-card-header{padding:3mm 3mm 1.5mm!important}.catalog-card-title{font-size:10pt!important;line-height:1.25!important}.catalog-condition{font-size:6.8pt!important;padding:.5mm 1.2mm!important}
          .catalog-card-content{padding:1.5mm 3mm 3mm!important}.catalog-description{min-height:8mm!important;font-size:7.5pt!important;line-height:1.35!important}.catalog-quantity{font-size:14pt!important}
          .catalog-print-footer{display:block!important;margin-top:5mm!important;padding-top:3mm!important;border-top:1px solid #cbd5e1!important;text-align:center!important;font-size:7.5pt!important;color:#64748b!important}
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
