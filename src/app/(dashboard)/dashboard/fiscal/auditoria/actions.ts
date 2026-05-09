"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { parseNfeXml } from "@/lib/fiscal/nfe-parser";

const NFE_XML_BUCKET = "fiscal-nfe-xmls";

async function getContext() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado.");
  }

  return { supabase, establishmentId: String(establishmentId) };
}

function classifyIssue(note: any) {
  const issues: string[] = [];

  if (!note.imported_entry_id) {
    issues.push("sem_entrada");
  }

  if (!note.xml_path) {
    issues.push("sem_xml");
  }

  if (note.status_manifestacao === "resumo_disponivel") {
    issues.push("somente_resumo");
  }

  if (["pendente", null, undefined, ""].includes(note.status_manifestacao)) {
    issues.push("manifestacao_pendente");
  }

  if (!note.fornecedor_cnpj) {
    issues.push("fornecedor_sem_cnpj");
  }

  if (!note.valor_total || Number(note.valor_total) <= 0) {
    issues.push("valor_zerado");
  }

  return issues;
}

function normalizeForMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

function mappingScore(item: any, supplierDocument: string | null | undefined, mapping: any) {
  let score = 0;
  const supplier = normalizeForMatch(supplierDocument);
  const mappingSupplier = normalizeForMatch(mapping.supplier_document);

  if (mappingSupplier && supplier && mappingSupplier !== supplier) {
    return -1;
  }

  if (mappingSupplier && supplier && mappingSupplier === supplier) score += 10;
  if (mapping.xml_code && normalizeForMatch(mapping.xml_code) === normalizeForMatch(item.code)) score += 8;
  if (mapping.xml_ean && normalizeForMatch(mapping.xml_ean) === normalizeForMatch(item.ean)) score += 10;
  if (mapping.xml_description && normalizeForMatch(mapping.xml_description) === normalizeForMatch(item.description)) score += 6;
  if (mapping.xml_description && normalizeForMatch(item.description).includes(normalizeForMatch(mapping.xml_description))) score += 3;
  if (mapping.xml_unit && normalizeForMatch(mapping.xml_unit) === normalizeForMatch(item.unit)) score += 2;

  return score;
}

function findMappedProduct(item: any, supplierDocument: string | null | undefined, products: any[], mappings: any[]) {
  const candidates = mappings
    .map((mapping) => ({ mapping, score: mappingScore(item, supplierDocument, mapping) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];

  if (!best) return null;

  const product = products.find((row) => String(row.id) === String(best.mapping.product_id));

  if (!product) return null;

  return {
    product,
    matchType: "vinculo_manual",
    mappingId: best.mapping.id,
  };
}

function findProductMatch(item: any, products: any[], mappings: any[] = [], supplierDocument?: string | null) {
  const mapped = findMappedProduct(item, supplierDocument, products, mappings);

  if (mapped) return mapped;

  const code = normalizeForMatch(item.code);
  const ean = normalizeForMatch(item.ean);
  const description = normalizeForMatch(item.description);

  const bySkuOrEan = products.find((product) => {
    const sku = normalizeForMatch(product.sku);
    return Boolean(sku && (sku === code || sku === ean));
  });

  if (bySkuOrEan) return { product: bySkuOrEan, matchType: "sku_ean", mappingId: null };

  const byExactName = products.find((product) => normalizeForMatch(product.name) === description);

  if (byExactName) return { product: byExactName, matchType: "nome_exato", mappingId: null };

  const byContainsName = products.find((product) => {
    const productName = normalizeForMatch(product.name);
    return Boolean(
      productName &&
        description &&
        (productName.includes(description) || description.includes(productName))
    );
  });

  if (byContainsName) return { product: byContainsName, matchType: "nome_aproximado", mappingId: null };

  return { product: null, matchType: "sem_vinculo", mappingId: null };
}

export async function getFiscalAuditAction() {
  const { supabase, establishmentId } = await getContext();

  const { data: notes, error } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id, chave_acesso, numero, serie, fornecedor_nome, fornecedor_cnpj, valor_total, data_emissao, status_manifestacao, xml_path, imported_entry_id, created_at, updated_at")
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Não foi possível carregar auditoria fiscal.");
  }

  const audited = (notes ?? []).map((note: any) => ({
    ...note,
    issues: classifyIssue(note),
  }));

  const withIssues = audited.filter((note: any) => note.issues.length > 0);

  return {
    summary: {
      total: audited.length,
      withIssues: withIssues.length,
      withoutEntry: audited.filter((note: any) => note.issues.includes("sem_entrada")).length,
      xmlPending: audited.filter((note: any) => note.issues.includes("sem_xml") || note.issues.includes("somente_resumo")).length,
      manifestationPending: audited.filter((note: any) => note.issues.includes("manifestacao_pendente")).length,
      supplierIssues: audited.filter((note: any) => note.issues.includes("fornecedor_sem_cnpj")).length,
    },
    issues: withIssues.slice(0, 100),
  };
}

export async function auditFiscalNfeProductsAction(noteId: string) {
  const { supabase, establishmentId } = await getContext();

  const { data: note, error: noteError } = await supabase
    .from("fiscal_nfe_inbox")
    .select("id, numero, serie, fornecedor_nome, fornecedor_cnpj, chave_acesso, xml_path, status_manifestacao")
    .eq("id", noteId)
    .eq("establishment_id", establishmentId)
    .single();

  if (noteError || !note) {
    console.error(noteError);
    throw new Error("NF-e não encontrada para auditoria de produtos.");
  }

  if (!note.xml_path) {
    throw new Error("Essa NF-e ainda não possui XML para auditoria.");
  }

  const { data: xmlFile, error: downloadError } = await supabase.storage
    .from(NFE_XML_BUCKET)
    .download(String(note.xml_path));

  if (downloadError || !xmlFile) {
    console.error(downloadError);
    throw new Error("Não foi possível baixar o XML da NF-e.");
  }

  const xmlText = await xmlFile.text();

  if (!xmlText.includes("<infNFe") && !xmlText.includes(":infNFe")) {
    throw new Error("Essa NF-e ainda está apenas como resumo. Manifeste e sincronize novamente para liberar o XML completo.");
  }

  const parsed = parseNfeXml(xmlText);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, default_unit_label, standard_cost, price")
    .eq("establishment_id", establishmentId);

  if (productsError) {
    console.error(productsError);
    throw new Error("Não foi possível carregar os produtos cadastrados.");
  }

  const { data: mappings, error: mappingsError } = await supabase
    .from("fiscal_product_mappings")
    .select("*")
    .eq("establishment_id", establishmentId);

  if (mappingsError) {
    console.error(mappingsError);
    throw new Error("Não foi possível carregar os vínculos fiscais.");
  }

  const rows = parsed.items.map((item, index) => {
    const match = findProductMatch(item, products ?? [], mappings ?? [], note.fornecedor_cnpj);
    const product = match.product;
    const productCost = Number(product?.standard_cost ?? product?.price ?? 0);
    const xmlCost = Number(item.unitCost || 0);
    const costDifference = product ? Number((xmlCost - productCost).toFixed(2)) : null;
    const costDifferencePercent = productCost > 0
      ? Number(((costDifference! / productCost) * 100).toFixed(2))
      : null;

    const issues: string[] = [];

    if (!product) {
      issues.push("produto_nao_vinculado");
    }

    if (product && item.unit && product.default_unit_label && String(product.default_unit_label).toUpperCase() !== String(item.unit).toUpperCase()) {
      issues.push("unidade_divergente");
    }

    if (product && costDifference !== null && Math.abs(costDifference) > 0.01) {
      issues.push("custo_divergente");
    }

    return {
      index: index + 1,
      xml: {
        code: item.code,
        ean: item.ean,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
      },
      product: product
        ? {
            id: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.default_unit_label,
            cost: productCost,
          }
        : null,
      matchType: match.matchType,
      mappingId: match.mappingId,
      costDifference,
      costDifferencePercent,
      issues,
    };
  });

  return {
    note: {
      id: note.id,
      numero: note.numero,
      serie: note.serie,
      fornecedor_nome: note.fornecedor_nome,
      fornecedor_cnpj: note.fornecedor_cnpj,
      chave_acesso: note.chave_acesso,
      status_manifestacao: note.status_manifestacao,
    },
    summary: {
      totalItems: rows.length,
      matched: rows.filter((row) => row.product).length,
      mapped: rows.filter((row) => row.matchType === "vinculo_manual").length,
      unmatched: rows.filter((row) => !row.product).length,
      withIssues: rows.filter((row) => row.issues.length > 0).length,
      costDivergences: rows.filter((row) => row.issues.includes("custo_divergente")).length,
      unitDivergences: rows.filter((row) => row.issues.includes("unidade_divergente")).length,
    },
    items: rows,
  };
}
