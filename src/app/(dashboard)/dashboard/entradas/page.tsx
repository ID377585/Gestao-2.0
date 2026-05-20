"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createInvoiceEntry,
  deleteInvoiceEntryAttachmentAction,
  deleteInvoiceEntryDraft,
  reverseInvoiceEntry,
  saveInvoiceEntryDraft,
  updateInvoiceEntry,
  uploadInvoiceEntryAttachmentAction,
  listInvoiceEntries,
  type InvoiceEntryDraftPayload,
  type InvoiceEntryInput,
} from "./actions";

type ProductCatalogItem = {
  id: string;
  name: string;
  sku?: string | null;
  default_unit_label?: string | null;
  price?: number | null;
  standard_cost?: number | null;
  category?: string | null;
  sector_category?: string | null;
  shelf_life_days?: number | null;
};

type SupplierCatalogItem = {
  id: string;
  name: string;
  document: string | null;
};

type EntryItemDraft = {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitLabel: string;
  unitCost: number;
  totalCost: number;
  xmlCode?: string | null;
};

type InvoiceEntryRow = {
  id: string;
  supplier_name: string;
  supplier_document: string | null;
  invoice_number: string;
  invoice_series: string | null;
  invoice_key: string | null;
  issue_date: string;
  entry_date: string;
  total_amount: number;
  notes: string | null;
  status: "active" | "cancelled";
  imported_from_xml: boolean;
  attachment_xml_url: string | null;
  attachment_xml_path: string | null;
  attachment_pdf_url: string | null;
  attachment_pdf_path: string | null;
  created_at: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name_snapshot: string;
    quantity: number;
    unit_label: string;
    unit_cost: number;
    total_cost: number;
    sort_order: number;
  }>;
};

type ParsedNfeItem = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
};

type ParsedNfe = {
  supplierName: string;
  supplierDocument: string | null;
  invoiceNumber: string;
  invoiceSeries: string | null;
  invoiceKey: string | null;
  issueDate: string;
  items: ParsedNfeItem[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function escapeCsv(val: unknown) {
  const s = String(val ?? "");

  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }

  return s;
}

function normalizeEntry(raw: any): InvoiceEntryRow {
  return {
    id: String(raw.id),
    supplier_name: String(raw.supplier_name ?? ""),
    supplier_document: raw.supplier_document
      ? String(raw.supplier_document)
      : null,
    invoice_number: String(raw.invoice_number ?? ""),
    invoice_series: raw.invoice_series ? String(raw.invoice_series) : null,
    invoice_key: raw.invoice_key ? String(raw.invoice_key) : null,
    issue_date: String(raw.issue_date ?? ""),
    entry_date: String(raw.entry_date ?? ""),
    total_amount: Number(raw.total_amount ?? 0),
    notes: raw.notes ? String(raw.notes) : null,
    status: String(raw.status ?? "active") as "active" | "cancelled",
    imported_from_xml: Boolean(raw.imported_from_xml),
    attachment_xml_url: raw.attachment_xml_url
      ? String(raw.attachment_xml_url)
      : null,
    attachment_xml_path: raw.attachment_xml_path
      ? String(raw.attachment_xml_path)
      : null,
    attachment_pdf_url: raw.attachment_pdf_url
      ? String(raw.attachment_pdf_url)
      : null,
    attachment_pdf_path: raw.attachment_pdf_path
      ? String(raw.attachment_pdf_path)
      : null,
    created_at: String(raw.created_at ?? ""),
    items: Array.isArray(raw.items)
      ? raw.items
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item: any) => ({
            id: String(item.id),
            product_id: String(item.product_id),
            product_name_snapshot: String(item.product_name_snapshot ?? ""),
            quantity: Number(item.quantity ?? 0),
            unit_label: String(item.unit_label ?? "UN").toUpperCase(),
            unit_cost: Number(item.unit_cost ?? 0),
            total_cost: Number(item.total_cost ?? 0),
            sort_order: Number(item.sort_order ?? 0),
          }))
      : [],
  };
}

function normalizeTextForCompare(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findTagText(node: Document | Element, tagName: string) {
  const elements = Array.from(node.getElementsByTagName("*"));
  const found = elements.find(
    (el) => el.localName?.toLowerCase() === tagName.toLowerCase()
  );

  return found?.textContent?.trim() ?? "";
}

function parseNfeXml(xmlContent: string): ParsedNfe {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlContent, "application/xml");
  const parserError = xml.getElementsByTagName("parsererror")[0];

  if (parserError) {
    throw new Error("O XML da NF-e é inválido ou não pôde ser lido.");
  }

  const infNFe = Array.from(xml.getElementsByTagName("*")).find(
    (el) => el.localName?.toLowerCase() === "infnfe"
  );

  if (!infNFe) {
    throw new Error("Não foi encontrada a estrutura infNFe no XML.");
  }

  const emit = Array.from(xml.getElementsByTagName("*")).find(
    (el) => el.localName?.toLowerCase() === "emit"
  );

  const ide = Array.from(xml.getElementsByTagName("*")).find(
    (el) => el.localName?.toLowerCase() === "ide"
  );

  const detNodes = Array.from(xml.getElementsByTagName("*")).filter(
    (el) => el.localName?.toLowerCase() === "det"
  );

  const rawKey = infNFe.getAttribute("Id") || "";
  const invoiceKey = rawKey.replace(/^NFe/i, "") || null;

  const supplierName = emit ? findTagText(emit, "xNome") : "";
  const supplierDocument = emit
    ? findTagText(emit, "CNPJ") || findTagText(emit, "CPF")
    : "";
  const invoiceNumber = ide ? findTagText(ide, "nNF") : "";
  const invoiceSeries = ide ? findTagText(ide, "serie") : "";
  const issueDateRaw = ide
    ? findTagText(ide, "dhEmi") || findTagText(ide, "dEmi")
    : "";

  const issueDate = issueDateRaw ? issueDateRaw.slice(0, 10) : "";

  const items: ParsedNfeItem[] = detNodes.map((det) => {
    const prod = Array.from(det.children).find(
      (el) => el.localName?.toLowerCase() === "prod"
    );

    if (!prod) {
      return {
        code: "",
        description: "",
        quantity: 0,
        unit: "UN",
        unitCost: 0,
        totalCost: 0,
      };
    }

    const code = findTagText(prod, "cProd");
    const description = findTagText(prod, "xProd");
    const quantity = toNumber(findTagText(prod, "qCom"), 0);
    const unit = findTagText(prod, "uCom") || "UN";
    const unitCost = toNumber(findTagText(prod, "vUnCom"), 0);
    const totalCost = toNumber(findTagText(prod, "vProd"), quantity * unitCost);

    return {
      code,
      description,
      quantity,
      unit,
      unitCost,
      totalCost,
    };
  });

  return {
    supplierName,
    supplierDocument: supplierDocument || null,
    invoiceNumber,
    invoiceSeries: invoiceSeries || null,
    invoiceKey,
    issueDate,
    items: items.filter((item) => item.description || item.code),
  };
}

function buildPrintHtml(entry: InvoiceEntryRow) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Entrada - NF ${entry.invoice_number}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
  h1 { margin: 0 0 8px 0; }
  .muted { color: #6b7280; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
  .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
  .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
  .value { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
  th { background: #f9fafb; }
  .right { text-align: right; }
</style>
</head>
<body>
  <h1>NF ${entry.invoice_number}${entry.invoice_series ? ` / ${entry.invoice_series}` : ""}</h1>
  <p class="muted">Fornecedor: ${entry.supplier_name}</p>

  <div class="grid">
    <div class="box"><div class="label">Emissão</div><div class="value">${formatDate(entry.issue_date)}</div></div>
    <div class="box"><div class="label">Entrada</div><div class="value">${formatDate(entry.entry_date)}</div></div>
    <div class="box"><div class="label">Status</div><div class="value">${entry.status === "active" ? "Ativa" : "Estornada"}</div></div>
    <div class="box"><div class="label">Total</div><div class="value">${formatCurrency(entry.total_amount)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Un.</th>
        <th class="right">Custo unit.</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${entry.items
        .map(
          (item) => `
        <tr>
          <td>${item.product_name_snapshot}</td>
          <td>${item.quantity}</td>
          <td>${item.unit_label}</td>
          <td class="right">${formatCurrency(item.unit_cost)}</td>
          <td class="right">${formatCurrency(item.total_cost)}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
    }
  </script>
</body>
</html>
  `.trim();
}

export default function EntradasPage() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierCatalogItem[]>([]);
  const [entries, setEntries] = useState<InvoiceEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("Rascunho de entrada");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierDocument, setSupplierDocument] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [invoiceKey, setInvoiceKey] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [entryDate, setEntryDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [importedFromXml, setImportedFromXml] = useState(false);
  const [updateProductStandardCost, setUpdateProductStandardCost] =
    useState(false);

  const [attachmentXmlUrl, setAttachmentXmlUrl] = useState<string | null>(null);
  const [attachmentXmlPath, setAttachmentXmlPath] = useState<string | null>(null);
  const [attachmentPdfUrl, setAttachmentPdfUrl] = useState<string | null>(null);
  const [attachmentPdfPath, setAttachmentPdfPath] = useState<string | null>(null);

  const [items, setItems] = useState<EntryItemDraft[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<InvoiceEntryRow | null>(
    null
  );

  const [draftProductId, setDraftProductId] = useState("");
  const [draftProductName, setDraftProductName] = useState("");
  const [draftProductSku, setDraftProductSku] = useState<string | null>(null);
  const [draftQuantity, setDraftQuantity] = useState<number>(0);
  const [draftUnitLabel, setDraftUnitLabel] = useState("UN");
  const [draftUnitCost, setDraftUnitCost] = useState<number>(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "cancelled"
  >("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  const xmlInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const handleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierId(supplierId);

    const selectedSupplier = suppliers.find((item) => item.id === supplierId);

    if (!selectedSupplier) {
      setSupplierName("");
      setSupplierDocument("");
      return;
    }

    setSupplierName(selectedSupplier.name);
    setSupplierDocument(selectedSupplier.document ?? "");
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [productsRes, suppliersRes, entriesRes] = await Promise.all([
        fetch("/api/products/catalog", { cache: "no-store" }),
        fetch("/api/suppliers/catalog", { cache: "no-store" }),
        listInvoiceEntries(),
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();

        const normalizedProducts = Array.isArray(productsData)
          ? productsData.map((product: any) => ({
              id: String(product.id),
              name: String(product.name ?? ""),
              sku: product.sku ? String(product.sku) : null,
              default_unit_label: product.default_unit_label ?? "UN",
              price: Number(product.price ?? 0),
              standard_cost: Number(product.standard_cost ?? 0),
              category: product.category ? String(product.category) : null,
              sector_category: product.sector_category
                ? String(product.sector_category)
                : null,
              shelf_life_days: Number(product.shelf_life_days ?? 0),
            }))
          : [];

        setProducts(normalizedProducts);
      } else {
        setProducts([]);
      }

      if (suppliersRes.ok) {
  const suppliersData = await suppliersRes.json();

  const normalizedSuppliers = Array.isArray(suppliersData)
    ? suppliersData
        .map((supplier: any) => ({
          id: String(supplier.id ?? ""),
          name: String(
            supplier.name ??
              supplier.razaoSocial ??
              supplier.razao_social ??
              supplier.nomeFantasia ??
              supplier.nome_fantasia ??
              ""
          ).trim(),
          document: supplier.document
            ? String(supplier.document)
            : supplier.cnpj
            ? String(supplier.cnpj)
            : null,
        }))
        .filter((supplier) => supplier.id && supplier.name)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];

  setSuppliers(normalizedSuppliers);
} else {
  console.error(
    "Erro ao carregar fornecedores:",
    suppliersRes.status,
    await suppliersRes.text()
  );
  setSuppliers([]);
}

      const normalizedEntries = Array.isArray(entriesRes)
        ? entriesRes.map(normalizeEntry)
        : [];

      setEntries(normalizedEntries);

      setSelectedEntry((prev) => {
        if (!prev) return null;

        const stillExists = normalizedEntries.some(
          (entry) => entry.id === prev.id
        );

        return stillExists ? prev : null;
      });
    } catch (error) {
      console.error("Erro ao carregar entradas:", error);
      alert("Erro ao carregar a sessão de entradas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedSupplierId || suppliers.length === 0) return;

    const currentSupplier = suppliers.find(
      (item) => item.id === selectedSupplierId
    );

    if (!currentSupplier) return;

    setSupplierName(currentSupplier.name);
    setSupplierDocument(currentSupplier.document ?? "");
  }, [selectedSupplierId, suppliers]);

  const resetDraftItem = () => {
    setDraftProductId("");
    setDraftProductName("");
    setDraftProductSku(null);
    setDraftQuantity(0);
    setDraftUnitLabel("UN");
    setDraftUnitCost(0);
    setEditingItemId(null);
  };

  const resetForm = () => {
    setCurrentDraftId(null);
    setDraftName("Rascunho de entrada");
    setEditingEntryId(null);
    setSelectedSupplierId("");
    setSupplierName("");
    setSupplierDocument("");
    setInvoiceNumber("");
    setInvoiceSeries("");
    setInvoiceKey("");
    setIssueDate("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setImportedFromXml(false);
    setUpdateProductStandardCost(false);
    setAttachmentXmlUrl(null);
    setAttachmentXmlPath(null);
    setAttachmentPdfUrl(null);
    setAttachmentPdfPath(null);
    setItems([]);
    resetDraftItem();
  };

  const buildDraftPayload = (): InvoiceEntryDraftPayload => ({
    supplier_name: supplierName,
    supplier_document: supplierDocument || null,
    invoice_number: invoiceNumber,
    invoice_series: invoiceSeries || null,
    invoice_key: invoiceKey || null,
    issue_date: issueDate,
    entry_date: entryDate,
    notes: notes || null,
    imported_from_xml: importedFromXml,
    attachment_xml_url: attachmentXmlUrl,
    attachment_xml_path: attachmentXmlPath,
    attachment_pdf_url: attachmentPdfUrl,
    attachment_pdf_path: attachmentPdfPath,
    update_product_standard_cost: updateProductStandardCost,
    items: items.map((item, index) => ({
      product_id: item.productId,
      product_name_snapshot: item.productName,
      quantity: item.quantity,
      unit_label: item.unitLabel,
      unit_cost: item.unitCost,
      total_cost: item.totalCost,
      sort_order: index,
    })),
  });

  const totalItemsDraft = useMemo(() => items.length, [items]);

  const totalAmountDraft = useMemo(() => {
    return Number(
      items.reduce((acc, item) => acc + item.totalCost, 0).toFixed(2)
    );
  }, [items]);

  const onSelectProduct = (productId: string) => {
    setDraftProductId(productId);

    const product = products.find((item) => item.id === productId);

    if (!product) return;

    setDraftProductName(product.name);
    setDraftProductSku(product.sku ?? null);
    setDraftUnitLabel(String(product.default_unit_label || "UN").toUpperCase());
    setDraftUnitCost(Number(product.standard_cost || product.price || 0));
  };

  const addOrUpdateItem = () => {
    const quantity = toNumber(draftQuantity, 0);
    const unitCost = toNumber(draftUnitCost, 0);

    if (!draftProductId) {
      alert("Selecione um produto.");
      return;
    }

    if (quantity <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    if (unitCost < 0) {
      alert("Informe um custo unitário válido.");
      return;
    }

    const totalCost = Number((quantity * unitCost).toFixed(2));

    const payload: EntryItemDraft = {
      id: editingItemId || uid(),
      productId: draftProductId,
      productName: draftProductName,
      productSku: draftProductSku,
      quantity,
      unitLabel: String(draftUnitLabel || "UN").toUpperCase(),
      unitCost,
      totalCost,
    };

    if (editingItemId) {
      setItems((prev) =>
        prev.map((item) => (item.id === editingItemId ? payload : item))
      );
    } else {
      setItems((prev) => [...prev, payload]);
    }

    resetDraftItem();
  };

  const editItem = (id: string) => {
    const found = items.find((item) => item.id === id);

    if (!found) return;

    setEditingItemId(found.id);
    setDraftProductId(found.productId);
    setDraftProductName(found.productName);
    setDraftProductSku(found.productSku ?? null);
    setDraftQuantity(found.quantity);
    setDraftUnitLabel(found.unitLabel);
    setDraftUnitCost(found.unitCost);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (editingItemId === id) {
      resetDraftItem();
    }
  };

  const uploadAttachment = async (file: File, kind: "xml" | "pdf") => {
    const formData = new FormData();

    formData.append("file", file);
    formData.append("kind", kind);

    return uploadInvoiceEntryAttachmentAction(formData);
  };

  const findProductMatch = (xmlItem: ParsedNfeItem) => {
    const normalizedCode = normalizeTextForCompare(xmlItem.code);
    const normalizedDescription = normalizeTextForCompare(xmlItem.description);

    const bySku = products.find((product) => {
      const sku = normalizeTextForCompare(product.sku ?? "");

      return sku && normalizedCode && sku === normalizedCode;
    });

    if (bySku) return bySku;

    const byNameExact = products.find((product) => {
      return normalizeTextForCompare(product.name) === normalizedDescription;
    });

    if (byNameExact) return byNameExact;

    const byNameContains = products.find((product) => {
      const productName = normalizeTextForCompare(product.name);

      return (
        productName.includes(normalizedDescription) ||
        normalizedDescription.includes(productName)
      );
    });

    return byNameContains ?? null;
  };

  const handleImportXml = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setUploadingAttachment(true);

      const text = await file.text();
      const parsed = parseNfeXml(text);

      if (!parsed.items.length) {
        throw new Error("O XML não possui itens de produto válidos.");
      }

      const uploaded = await uploadAttachment(file, "xml");

      const matchedSupplier = suppliers.find(
        (supplier) =>
          normalizeTextForCompare(supplier.name) ===
            normalizeTextForCompare(parsed.supplierName || "") ||
          (supplier.document &&
            parsed.supplierDocument &&
            normalizeTextForCompare(supplier.document) ===
              normalizeTextForCompare(parsed.supplierDocument))
      );

      setSelectedSupplierId(matchedSupplier?.id ?? "");
      setSupplierName(parsed.supplierName || matchedSupplier?.name || "");
      setSupplierDocument(
        parsed.supplierDocument || matchedSupplier?.document || ""
      );
      setInvoiceNumber(parsed.invoiceNumber || "");
      setInvoiceSeries(parsed.invoiceSeries || "");
      setInvoiceKey(parsed.invoiceKey || "");
      setIssueDate(parsed.issueDate || "");
      setEntryDate(new Date().toISOString().slice(0, 10));
      setImportedFromXml(true);
      setAttachmentXmlUrl(uploaded.fileUrl);
      setAttachmentXmlPath(uploaded.filePath);

      const parsedItems: EntryItemDraft[] = parsed.items
        .map((item) => {
          const matched = findProductMatch(item);

          if (!matched) return null;

          const unitCost = Number(
            item.unitCost || matched.standard_cost || matched.price || 0
          );

          return {
            id: uid(),
            productId: matched.id,
            productName: matched.name,
            productSku: matched.sku ?? null,
            quantity: item.quantity,
            unitLabel: String(
              matched.default_unit_label || item.unit || "UN"
            ).toUpperCase(),
            unitCost,
            totalCost: Number((item.quantity * unitCost).toFixed(2)),
            xmlCode: item.code || null,
          };
        })
        .filter(Boolean) as EntryItemDraft[];

      if (!parsedItems.length) {
        throw new Error(
          "Nenhum item do XML conseguiu ser vinculado aos produtos cadastrados. Verifique SKUs ou nomes."
        );
      }

      setItems(parsedItems);

      alert("XML importado com sucesso. Revise os dados antes de confirmar.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "Não foi possível importar o XML.");
    } finally {
      setUploadingAttachment(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleUploadPdf = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setUploadingAttachment(true);

      const uploaded = await uploadAttachment(file, "pdf");

      setAttachmentPdfUrl(uploaded.fileUrl);
      setAttachmentPdfPath(uploaded.filePath);

      alert("PDF anexado com sucesso.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "Não foi possível anexar o PDF.");
    } finally {
      setUploadingAttachment(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const saveDraft = () => {
    const payload = buildDraftPayload();

    startTransition(async () => {
      try {
        const result = await saveInvoiceEntryDraft(
          draftName,
          payload,
          currentDraftId || undefined
        );

        setCurrentDraftId(result.id);

        await loadData();

        alert("Rascunho salvo com sucesso.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message ?? "Não foi possível salvar o rascunho.");
      }
    });
  };

  const loadEntryForEdit = (entry: InvoiceEntryRow) => {
    setEditingEntryId(entry.id);
    setCurrentDraftId(null);
    setDraftName(`Edição NF ${entry.invoice_number}`);

    const matchedSupplier = suppliers.find(
      (item) =>
        item.name.trim().toLowerCase() ===
        entry.supplier_name.trim().toLowerCase()
    );

    setSelectedSupplierId(matchedSupplier?.id ?? "");
    setSupplierName(entry.supplier_name);
    setSupplierDocument(entry.supplier_document || "");
    setInvoiceNumber(entry.invoice_number);
    setInvoiceSeries(entry.invoice_series || "");
    setInvoiceKey(entry.invoice_key || "");
    setIssueDate(entry.issue_date);
    setEntryDate(entry.entry_date);
    setNotes(entry.notes || "");
    setImportedFromXml(entry.imported_from_xml);
    setAttachmentXmlUrl(entry.attachment_xml_url || null);
    setAttachmentXmlPath(entry.attachment_xml_path || null);
    setAttachmentPdfUrl(entry.attachment_pdf_url || null);
    setAttachmentPdfPath(entry.attachment_pdf_path || null);
    setUpdateProductStandardCost(false);

    setItems(
      entry.items.map((item) => {
        const product = products.find((p) => p.id === item.product_id);

        return {
          id: uid(),
          productId: item.product_id,
          productName: item.product_name_snapshot,
          productSku: product?.sku ?? null,
          quantity: item.quantity,
          unitLabel: item.unit_label,
          unitCost: item.unit_cost,
          totalCost: item.total_cost,
        };
      })
    );

    resetDraftItem();

    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const saveEntry = () => {
    if (!supplierName.trim()) {
      alert("Informe o fornecedor.");
      return;
    }

    if (!invoiceNumber.trim()) {
      alert("Informe o número da nota.");
      return;
    }

    if (!issueDate) {
      alert("Informe a data de emissão.");
      return;
    }

    if (!entryDate) {
      alert("Informe a data de entrada.");
      return;
    }

    if (!items.length) {
      alert("Adicione pelo menos um item.");
      return;
    }

    const payload: InvoiceEntryInput = {
      id: editingEntryId || undefined,
      supplier_name: supplierName.trim(),
      supplier_document: supplierDocument.trim() || null,
      invoice_number: invoiceNumber.trim(),
      invoice_series: invoiceSeries.trim() || null,
      invoice_key: invoiceKey.trim() || null,
      issue_date: issueDate,
      entry_date: entryDate,
      notes: notes.trim() || null,
      imported_from_xml: importedFromXml,
      attachment_xml_url: attachmentXmlUrl,
      attachment_xml_path: attachmentXmlPath,
      attachment_pdf_url: attachmentPdfUrl,
      attachment_pdf_path: attachmentPdfPath,
      update_product_standard_cost: updateProductStandardCost,
      approval_status: "approved",
      items: items.map((item, index) => ({
        product_id: item.productId,
        product_name_snapshot: item.productName,
        quantity: item.quantity,
        unit_label: item.unitLabel,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        sort_order: index,
      })),
    };

    startTransition(async () => {
      try {
        if (editingEntryId) {
          await updateInvoiceEntry(payload);
          alert("Entrada atualizada com sucesso e estoque reaplicado.");
        } else {
          await createInvoiceEntry(payload);
          alert("Entrada lançada com sucesso e estoque atualizado.");
        }

        if (currentDraftId) {
          await deleteInvoiceEntryDraft(currentDraftId);
        }

        resetForm();

        await loadData();
      } catch (error: any) {
        console.error(error);
        alert(error?.message ?? "Não foi possível gravar a entrada.");
      }
    });
  };

  const handleReverse = (entryId: string) => {
    if (
      !confirm(
        "Deseja estornar esta entrada? O saldo do estoque será revertido."
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await reverseInvoiceEntry(entryId);

        await loadData();

        alert("Entrada estornada com sucesso.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message ?? "Não foi possível estornar a entrada.");
      }
    });
  };

  const handlePrint = (entry: InvoiceEntryRow) => {
    const html = buildPrintHtml(entry);
    const win = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=1200,height=900"
    );

    if (!win) return;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const supplierOptions = useMemo(() => {
    const unique = Array.from(
      new Set(entries.map((entry) => entry.supplier_name.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return ["all", ...unique];
  }, [entries]);

  const productOptionsFromHistory = useMemo(() => {
    const unique = Array.from(
      new Set(
        entries.flatMap((entry) =>
          entry.items
            .map((item) => item.product_name_snapshot.trim())
            .filter(Boolean)
        )
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return ["all", ...unique];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const min = minValue ? toNumber(minValue, 0) : null;
    const max = maxValue ? toNumber(maxValue, 0) : null;

    return entries.filter((entry) => {
      const matchesSearch =
        !q ||
        entry.invoice_number.toLowerCase().includes(q) ||
        (entry.invoice_series ?? "").toLowerCase().includes(q) ||
        (entry.invoice_key ?? "").toLowerCase().includes(q) ||
        entry.supplier_name.toLowerCase().includes(q) ||
        (entry.notes ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || entry.status === statusFilter;

      const matchesSupplier =
        supplierFilter === "all" || entry.supplier_name === supplierFilter;

      const matchesProduct =
        productFilter === "all" ||
        entry.items.some(
          (item) => item.product_name_snapshot === productFilter
        );

      const matchesStart = !periodStart || entry.entry_date >= periodStart;
      const matchesEnd = !periodEnd || entry.entry_date <= periodEnd;

      const matchesMin = min === null || entry.total_amount >= min;
      const matchesMax = max === null || entry.total_amount <= max;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
        matchesProduct &&
        matchesStart &&
        matchesEnd &&
        matchesMin &&
        matchesMax
      );
    });
  }, [
    entries,
    searchTerm,
    statusFilter,
    supplierFilter,
    productFilter,
    periodStart,
    periodEnd,
    minValue,
    maxValue,
  ]);

  useEffect(() => {
    setSelectedEntry((prev) => {
      if (!prev) return null;

      const stillVisible = filteredEntries.some((entry) => entry.id === prev.id);

      return stillVisible ? prev : null;
    });
  }, [filteredEntries]);

  const totalFilteredEntries = filteredEntries.length;

  const activeEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status === "active").length,
    [filteredEntries]
  );

  const cancelledEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status === "cancelled").length,
    [filteredEntries]
  );

  const totalHistoryAmount = useMemo(() => {
    return filteredEntries
      .filter((entry) => entry.status === "active")
      .reduce((acc, entry) => acc + entry.total_amount, 0);
  }, [filteredEntries]);

  const exportFilteredCsv = () => {
    if (!filteredEntries.length) {
      alert("Nenhuma entrada encontrada para exportar.");
      return;
    }

    const headers = [
      "fornecedor",
      "documento_fornecedor",
      "numero_nota",
      "serie",
      "chave_nfe",
      "data_emissao",
      "data_entrada",
      "status",
      "importado_xml",
      "valor_total",
      "qtd_itens",
      "anexo_xml",
      "anexo_pdf",
      "observacoes",
      "criado_em",
    ];

    const lines = [headers.join(";")];

    filteredEntries.forEach((entry) => {
      const row = [
        escapeCsv(entry.supplier_name),
        escapeCsv(entry.supplier_document ?? ""),
        escapeCsv(entry.invoice_number),
        escapeCsv(entry.invoice_series ?? ""),
        escapeCsv(entry.invoice_key ?? ""),
        escapeCsv(entry.issue_date),
        escapeCsv(entry.entry_date),
        escapeCsv(entry.status),
        escapeCsv(entry.imported_from_xml ? "sim" : "nao"),
        escapeCsv(entry.total_amount.toFixed(2)),
        escapeCsv(entry.items.length),
        escapeCsv(entry.attachment_xml_url ?? ""),
        escapeCsv(entry.attachment_pdf_url ?? ""),
        escapeCsv(entry.notes ?? ""),
        escapeCsv(entry.created_at),
      ];

      lines.push(row.join(";"));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "historico_entradas_v3.csv";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setProductFilter("all");
    setPeriodStart("");
    setPeriodEnd("");
    setMinValue("");
    setMaxValue("");
  };

  const getCostReview = (
    item: EntryItemDraft | InvoiceEntryRow["items"][number]
  ) => {
    const product =
      "productId" in item
        ? products.find((p) => p.id === item.productId)
        : products.find((p) => p.id === item.product_id);

    const currentCost = Number(product?.standard_cost || product?.price || 0);
    const incomingCost = Number(
      "unitCost" in item ? item.unitCost : item.unit_cost
    );

    if (!currentCost || currentCost <= 0) {
      return {
        currentCost,
        incomingCost,
        diffPercent: null as number | null,
        label: "Sem base cadastrada",
      };
    }

    const diffPercent = Number(
      (((incomingCost - currentCost) / currentCost) * 100).toFixed(2)
    );

    let label = "Dentro da faixa";

    if (diffPercent > 10) label = "Acima do custo atual";
    if (diffPercent < -10) label = "Abaixo do custo atual";

    return {
      currentCost,
      incomingCost,
      diffPercent,
      label,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entradas</h1>
          <p className="text-gray-600">
            Versão 3 com rascunho persistente, edição de entrada lançada, XML,
            anexos e conferência de custos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportFilteredCsv}>
            Exportar CSV
          </Button>

          <Button type="button" variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>

          <Button type="button" variant="outline" onClick={resetForm}>
            Novo lançamento
          </Button>
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          Carregando entradas...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Notas filtradas
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">{totalFilteredEntries}</div>
            <p className="text-xs text-muted-foreground">Histórico visível</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeEntries}
            </div>
            <p className="text-xs text-muted-foreground">Notas válidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estornadas</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {cancelledEntries}
            </div>
            <p className="text-xs text-muted-foreground">Notas canceladas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor total</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalHistoryAmount)}
            </div>
            <p className="text-xs text-muted-foreground">Entradas ativas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros e pesquisa avançada</CardTitle>
          <CardDescription>
            Busque por número da nota, fornecedor, chave NF-e, produto e faixa
            de valor.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Label htmlFor="search_term">Pesquisa</Label>
            <Input
              id="search_term"
              placeholder="Número da nota, fornecedor, chave, observações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="status_filter">Status</Label>
            <select
              id="status_filter"
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "active" | "cancelled"
                )
              }
            >
              <option value="all">Todos</option>
              <option value="active">Ativas</option>
              <option value="cancelled">Estornadas</option>
            </select>
          </div>

          <div>
            <Label htmlFor="supplier_filter">Fornecedor</Label>
            <select
              id="supplier_filter"
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              {supplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier === "all" ? "Todos os fornecedores" : supplier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="product_filter">Produto</Label>
            <select
              id="product_filter"
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              {productOptionsFromHistory.map((product) => (
                <option key={product} value={product}>
                  {product === "all" ? "Todos os produtos" : product}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="period_start">Data inicial</Label>
            <Input
              id="period_start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="period_end">Data final</Label>
            <Input
              id="period_end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="min_value">Valor mínimo</Label>
            <Input
              id="min_value"
              type="number"
              step="0.01"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div>
            <Label htmlFor="max_value">Valor máximo</Label>
            <Input
              id="max_value"
              type="number"
              step="0.01"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </CardContent>
      </Card>

      <div ref={formRef}>
        <Card>
          <CardHeader>
            <CardTitle>
              {editingEntryId ? "Editar entrada lançada" : "Nova entrada"}
            </CardTitle>

            <CardDescription>
              Importe XML da NF-e, anexe arquivos, revise itens e confirme.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <input
                ref={xmlInputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={handleImportXml}
              />

              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleUploadPdf}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => xmlInputRef.current?.click()}
                disabled={uploadingAttachment}
              >
                {uploadingAttachment ? "Processando..." : "Importar XML da NF-e"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingAttachment}
              >
                {uploadingAttachment ? "Enviando..." : "Anexar PDF"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="supplier_select">Fornecedor</Label>
                <select
                  id="supplier_select"
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierSelection(e.target.value)}
                >
                  <option value="">— Selecionar fornecedor —</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="supplier_document">
                  Documento do fornecedor
                </Label>
                <Input
                  id="supplier_document"
                  value={supplierDocument}
                  readOnly
                  placeholder="CNPJ ou CPF"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice_number">Número da nota</Label>
                  <Input
                    id="invoice_number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex.: 12345"
                  />
                </div>

                <div>
                  <Label htmlFor="invoice_series">Série</Label>
                  <Input
                    id="invoice_series"
                    value={invoiceSeries}
                    onChange={(e) => setInvoiceSeries(e.target.value)}
                    placeholder="Ex.: 1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invoice_key">Chave da NF-e</Label>
                <Input
                  id="invoice_key"
                  value={invoiceKey}
                  onChange={(e) => setInvoiceKey(e.target.value)}
                  placeholder="Ex.: 3526..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issue_date">Data de emissão</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="entry_date">Data de entrada</Label>
                  <Input
                    id="entry_date"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações da nota fiscal..."
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-base font-semibold">Anexos e origem</h3>

              <div className="flex flex-wrap gap-2">
                <Badge variant={importedFromXml ? "default" : "secondary"}>
                  {importedFromXml ? "Importado de XML" : "Lançamento manual"}
                </Badge>

                {editingEntryId ? (
                  <Badge variant="outline">Modo edição</Badge>
                ) : null}

                {attachmentXmlUrl ? (
                  <a
                    href={attachmentXmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    Ver XML anexado
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sem XML anexado
                  </span>
                )}

                {attachmentPdfUrl ? (
                  <a
                    href={attachmentPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    Ver PDF anexado
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sem PDF anexado
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {attachmentXmlPath ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await deleteInvoiceEntryAttachmentAction(
                        attachmentXmlPath
                      );
                      setAttachmentXmlUrl(null);
                      setAttachmentXmlPath(null);
                      setImportedFromXml(false);
                    }}
                  >
                    Remover XML
                  </Button>
                ) : null}

                {attachmentPdfPath ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await deleteInvoiceEntryAttachmentAction(
                        attachmentPdfPath
                      );
                      setAttachmentPdfUrl(null);
                      setAttachmentPdfPath(null);
                    }}
                  >
                    Remover PDF
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-4 text-base font-semibold">
                Itens da entrada
              </h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Label>Produto</Label>
                  <select
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draftProductId}
                    onChange={(e) => onSelectProduct(e.target.value)}
                  >
                    <option value="">— Selecionar produto —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {product.sku ? ` (${product.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={draftQuantity}
                    onChange={(e) =>
                      setDraftQuantity(toNumber(e.target.value, 0))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Unidade</Label>
                  <Input
                    value={draftUnitLabel}
                    onChange={(e) =>
                      setDraftUnitLabel(e.target.value.toUpperCase())
                    }
                  />
                </div>

                <div className="md:col-span-3">
                  <Label>Custo unitário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draftUnitCost}
                    onChange={(e) =>
                      setDraftUnitCost(toNumber(e.target.value, 0))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button type="button" onClick={addOrUpdateItem}>
                  {editingItemId ? "Salvar item" : "Adicionar item"}
                </Button>

                {editingItemId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetDraftItem}
                  >
                    Cancelar edição
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">Total de itens</p>
                    <p className="font-bold">{totalItemsDraft}</p>
                  </div>

                  <div>
                    <p className="text-gray-600">Valor total da entrada</p>
                    <p className="font-bold">
                      {formatCurrency(totalAmountDraft)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item adicionado ainda.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Un.</TableHead>
                        <TableHead>Custo unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Conferência</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {items.map((item) => {
                        const review = getCostReview(item);

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">
                                {item.productName}
                              </div>

                              {item.productSku ? (
                                <div className="text-xs text-muted-foreground">
                                  SKU: {item.productSku}
                                </div>
                              ) : null}
                            </TableCell>

                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.unitLabel}</TableCell>
                            <TableCell>
                              {formatCurrency(item.unitCost)}
                            </TableCell>
                            <TableCell>{formatCurrency(item.totalCost)}</TableCell>

                            <TableCell>
                              <div className="text-xs">
                                <div>{review.label}</div>

                                <div className="text-muted-foreground">
                                  Base: {formatCurrency(review.currentCost)}
                                </div>

                                <div className="text-muted-foreground">
                                  Variação:{" "}
                                  {review.diffPercent === null
                                    ? "—"
                                    : `${review.diffPercent.toFixed(2)}%`}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => editItem(item.id)}
                                >
                                  Editar
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeItem(item.id)}
                                >
                                  Remover
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <input
                  id="update_product_standard_cost"
                  type="checkbox"
                  checked={updateProductStandardCost}
                  onChange={(e) =>
                    setUpdateProductStandardCost(e.target.checked)
                  }
                />

                <Label htmlFor="update_product_standard_cost">
                  Atualizar custo padrão dos produtos com base nesta entrada
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Limpar
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={saveDraft}
                disabled={isPending}
              >
                Salvar rascunho
              </Button>

              <Button type="button" onClick={saveEntry} disabled={isPending}>
                {isPending
                  ? "Processando..."
                  : editingEntryId
                  ? "Atualizar entrada"
                  : "Registrar entrada"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de notas lançadas</CardTitle>
          <CardDescription>
            Consulte as entradas registradas, imprima, edite, filtre e faça
            estorno quando necessário.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma entrada encontrada com os filtros atuais.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nota</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <Fragment key={entry.id}>
                        <TableRow
                          className={
                            selectedEntry?.id === entry.id ? "bg-slate-50" : ""
                          }
                        >
                          <TableCell className="font-medium">
                            NF {entry.invoice_number}
                            {entry.invoice_series
                              ? ` / ${entry.invoice_series}`
                              : ""}
                          </TableCell>

                          <TableCell>{entry.supplier_name}</TableCell>
                          <TableCell>{formatDate(entry.entry_date)}</TableCell>
                          <TableCell>
                            {formatCurrency(entry.total_amount)}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={
                                entry.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {entry.status === "active"
                                ? "Ativa"
                                : "Estornada"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setSelectedEntry((prev) =>
                                    prev?.id === entry.id ? null : entry
                                  )
                                }
                              >
                                {selectedEntry?.id === entry.id
                                  ? "Ocultar detalhes"
                                  : "Ver detalhes"}
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrint(entry)}
                              >
                                Imprimir
                              </Button>

                              {entry.status === "active" && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => loadEntryForEdit(entry)}
                                  >
                                    Editar
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReverse(entry.id)}
                                    disabled={isPending}
                                  >
                                    Estornar
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {selectedEntry?.id === entry.id && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <div className="rounded-xl border bg-white p-4">
                                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <h3 className="text-lg font-semibold">
                                      NF {entry.invoice_number}
                                      {entry.invoice_series
                                        ? ` / ${entry.invoice_series}`
                                        : ""}
                                    </h3>

                                    <p className="text-sm text-muted-foreground">
                                      Fornecedor: {entry.supplier_name}
                                    </p>

                                    <p className="text-sm text-muted-foreground">
                                      Lançada em:{" "}
                                      {formatDateTime(entry.created_at)}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Badge
                                      variant={
                                        entry.status === "active"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {entry.status === "active"
                                        ? "Ativa"
                                        : "Estornada"}
                                    </Badge>

                                    <Badge variant="outline">
                                      {entry.imported_from_xml
                                        ? "Importada de XML"
                                        : "Manual"}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Emissão
                                    </p>
                                    <p className="font-semibold">
                                      {formatDate(entry.issue_date)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Entrada
                                    </p>
                                    <p className="font-semibold">
                                      {formatDate(entry.entry_date)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Itens
                                    </p>
                                    <p className="font-semibold">
                                      {entry.items.length}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Total
                                    </p>
                                    <p className="font-semibold">
                                      {formatCurrency(entry.total_amount)}
                                    </p>
                                  </div>
                                </div>

                                {entry.supplier_document && (
                                  <div className="mt-4">
                                    <p className="text-xs text-muted-foreground">
                                      Documento fornecedor
                                    </p>
                                    <p className="text-sm font-medium">
                                      {entry.supplier_document}
                                    </p>
                                  </div>
                                )}

                                {entry.invoice_key && (
                                  <div className="mt-4">
                                    <p className="text-xs text-muted-foreground">
                                      Chave NF-e
                                    </p>
                                    <p className="break-all text-sm font-medium">
                                      {entry.invoice_key}
                                    </p>
                                  </div>
                                )}

                                <div className="mt-4 flex flex-wrap gap-3">
                                  {entry.attachment_xml_url ? (
                                    <a
                                      href={entry.attachment_xml_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm underline"
                                    >
                                      Abrir XML anexado
                                    </a>
                                  ) : null}

                                  {entry.attachment_pdf_url ? (
                                    <a
                                      href={entry.attachment_pdf_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm underline"
                                    >
                                      Abrir PDF anexado
                                    </a>
                                  ) : null}
                                </div>

                                {entry.notes && (
                                  <div className="mt-4">
                                    <p className="text-xs text-muted-foreground">
                                      Observações
                                    </p>
                                    <p className="whitespace-pre-wrap text-sm">
                                      {entry.notes}
                                    </p>
                                  </div>
                                )}

                                <div className="mt-4">
                                  <h4 className="mb-2 font-semibold">
                                    Itens da nota
                                  </h4>

                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Qtd</TableHead>
                                        <TableHead>Un.</TableHead>
                                        <TableHead>Custo unit.</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Conferência</TableHead>
                                      </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                      {entry.items.map((item) => {
                                        const review = getCostReview(item);

                                        return (
                                          <TableRow key={item.id}>
                                            <TableCell>
                                              {item.product_name_snapshot}
                                            </TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>
                                              {item.unit_label}
                                            </TableCell>
                                            <TableCell>
                                              {formatCurrency(item.unit_cost)}
                                            </TableCell>
                                            <TableCell>
                                              {formatCurrency(item.total_cost)}
                                            </TableCell>

                                            <TableCell>
                                              <div className="text-xs">
                                                <div>{review.label}</div>

                                                <div className="text-muted-foreground">
                                                  Base:{" "}
                                                  {formatCurrency(
                                                    review.currentCost
                                                  )}
                                                </div>

                                                <div className="text-muted-foreground">
                                                  Variação:{" "}
                                                  {review.diffPercent === null
                                                    ? "—"
                                                    : `${review.diffPercent.toFixed(
                                                        2
                                                      )}%`}
                                                </div>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}