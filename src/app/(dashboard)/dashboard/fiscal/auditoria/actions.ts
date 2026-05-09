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

function findProductMatch(item: any, products: any[]) {
  const code = normalizeForMatch(item.code);
  const ean = normalizeForMatch(item.ean);
  const description = normalizeForMatch(item.description);

  const bySkuOrEan = products.find((product) => {
    const sku = normalizeForMatch(product.sku);
    return Boolean(sku && (sku === code || sku === ean));
  });

  if (bySkuOrEan) return { product: bySkuOrEan, matchType: "sku_ean" };

  const byExactName = products.find((product) => normalizeForMatch(product.name) === description);

  if (byExactName) return { product: byExactName, matchType: "nome_exato" };

  const byContainsName = products.find((product) => {
    const productName = normalizeForMatch(product.name);
    return Boolean(
      productName &&
        description &&
        (productName.includes(description) || description.includes(productName))
    );
  });

  if (byContainsName) return { product: byContainsName, matchType: "nome_aproximado" };

  return { product: null, matchType: "sem_vinculo" };
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
    .select("id, numero, serie, fornecedor_nome, chave_acesso, xml_path, status_manifestacao")
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

  const rows = parsed.items.map((item, index) => {
    const match = findProductMatch(item, products ?? []);
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
      chave_acesso: note.chave_acesso,
      status_manifestacao: note.status_manifestacao,
    },
    summary: {
      totalItems: rows.length,
      matched: rows.filter((row) => row.product).length,
      unmatched: rows.filter((row) => !row.product).length,
      withIssues: rows.filter((row) => row.issues.length > 0).length,
      costDivergences: rows.filter((row) => row.issues.includes("custo_divergente")).length,
      unitDivergences: rows.filter((row) => row.issues.includes("unidade_divergente")).length,
    },
    items: rows,
  };
}
