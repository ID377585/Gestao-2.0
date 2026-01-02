// src/app/api/import/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normaliza possível ID para evitar "undefined"/"null" em string.
 */
function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

/**
 * Converte string de número em number aceitando vírgula ou ponto.
 */
function parseNumberStr(
  value: string | null | undefined,
  decimals = 3
): number | null {
  if (value == null) return null;
  const str = String(value).replace(",", ".").trim();
  if (!str) return null;
  const n = Number(str);
  if (Number.isNaN(n)) return null;
  return Number(n.toFixed(decimals));
}

/**
 * Determina o delimitador do CSV ( ; ou , )
 */
function detectDelimiter(headerLine: string): ";" | "," {
  if (headerLine.includes(";")) return ";";
  return ",";
}

/**
 * Parser de CSV linha-a-linha com suporte básico a aspas
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

/**
 * Detecta se a request espera JSON (fetch/AJAX)
 */
function wantsJson(request: Request) {
  const accept = request.headers.get("accept") || "";
  const xrw = request.headers.get("x-requested-with") || "";
  const secFetchMode = request.headers.get("sec-fetch-mode") || "";

  if (accept.includes("application/json")) return true;
  if (xrw.toLowerCase() === "xmlhttprequest") return true;
  if (secFetchMode && secFetchMode !== "navigate") return true;

  return false;
}

export async function POST(request: Request) {
  try {
    const membership = await getActiveMembershipOrRedirect();
    const { organization_id, establishment_id, user_id } = membership as any;

    const membershipEstablishmentId =
      normalizeId(establishment_id) ?? normalizeId(organization_id);
    const userId = normalizeId(user_id);

    const supabase = await createSupabaseServerClient();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado." },
        { status: 400 }
      );
    }

    // ✅ CSV ONLY — bloqueia XLSX com mensagem clara
    const fileName = String((file as any)?.name || "").toLowerCase();
    if (fileName.endsWith(".xlsx") || file.type.includes("spreadsheetml")) {
      return NextResponse.json(
        {
          error:
            "Arquivo .xlsx não suportado. Exporte como CSV (UTF-8) e tente novamente.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(arrayBuffer);

    // remove BOM se existir
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);

    if (lines.length <= 1) {
      return NextResponse.json(
        { error: "Arquivo sem dados para importar." },
        { status: 400 }
      );
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);
    const headers = parseCsvLine(headerLine, delimiter).map((h) => h.trim());

    // ✅ Cabeçalhos obrigatórios
    const required = ["name", "product_type", "default_unit_label"];
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `CSV inválido. Cabeçalhos obrigatórios ausentes: ${missing.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // Monta registros
    const records: Record<string, string>[] = [];
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line, delimiter);
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = (cols[idx] ?? "").trim();
      });
      records.push(rec);
    }

    // ===============================
    // RESOLVER establishment_id
    // ===============================
    const csvEstabSet = new Set<string>();
    for (const rec of records) {
      const csvEstab = normalizeId(rec["establishment_id"]);
      if (csvEstab) csvEstabSet.add(csvEstab);
    }

    let effectiveEstablishmentId: string | null = null;

    if (membershipEstablishmentId) {
      effectiveEstablishmentId = membershipEstablishmentId;

      if (csvEstabSet.size > 0) {
        for (const v of csvEstabSet.values()) {
          if (v !== membershipEstablishmentId) {
            return NextResponse.json(
              {
                error:
                  "CSV contém establishment_id diferente do usuário logado.",
              },
              { status: 400 }
            );
          }
        }
      }
    } else {
      if (csvEstabSet.size !== 1) {
        return NextResponse.json(
          {
            error:
              "Preencha a coluna establishment_id no CSV com o mesmo UUID em todas as linhas.",
          },
          { status: 400 }
        );
      }
      effectiveEstablishmentId = Array.from(csvEstabSet)[0];
    }

    if (!effectiveEstablishmentId) {
      return NextResponse.json(
        { error: "Não foi possível determinar o establishment_id." },
        { status: 400 }
      );
    }

    // ===============================
    // PROCESSAMENTO
    // ===============================
    const upsertById: any[] = [];
    const upsertBySku: any[] = [];
    const insertNoSku: any[] = [];
    let skipped = 0;

    const nowIso = new Date().toISOString();

    for (const rec of records) {
      const id = normalizeId(rec["id"]);
      const sku = normalizeId(rec["sku"]);
      const name = (rec["name"] ?? "").trim();

      if (!name) {
        skipped++;
        continue;
      }

      const basePayload = {
        sku,
        name,
        product_type: ((rec["product_type"] ?? "INSU") as string).toUpperCase(),
        default_unit_label: (rec["default_unit_label"] ?? "un").trim(),
        package_qty: parseNumberStr(rec["package_qty"]),
        qty_per_package: rec["qty_per_package"] || null,
        category: rec["category"] || null,
        price: parseNumberStr(rec["price"], 2),
        conversion_factor: parseNumberStr(rec["conversion_factor"], 4) ?? 1,
        is_active:
          String(rec["is_active"] ?? "1").toLowerCase() !== "false",
      };

      if (id) {
        upsertById.push({
          id,
          establishment_id: effectiveEstablishmentId,
          ...basePayload,
          updated_by: userId,
          updated_at: nowIso,
        });
      } else if (sku) {
        upsertBySku.push({
          establishment_id: effectiveEstablishmentId,
          ...basePayload,
          created_by: userId,
          created_at: nowIso,
        });
      } else {
        insertNoSku.push({
          establishment_id: effectiveEstablishmentId,
          ...basePayload,
          created_by: userId,
          created_at: nowIso,
        });
      }
    }

    if (upsertBySku.length)
      await supabase
        .from("products")
        .upsert(upsertBySku, { onConflict: "establishment_id,sku" });

    if (insertNoSku.length)
      await supabase.from("products").insert(insertNoSku);

    if (upsertById.length)
      await supabase
        .from("products")
        .upsert(upsertById, { onConflict: "id" });

    const summary = {
      ok: true,
      total: records.length,
      skipped,
      establishment_id_used: effectiveEstablishmentId,
    };

    if (wantsJson(request)) {
      return NextResponse.json(summary, { status: 200 });
    }

    return NextResponse.redirect(
      new URL("/dashboard/produtos?success=import", request.url),
      303
    );
  } catch (err) {
    console.error("Erro inesperado em /api/import/products:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao importar produtos." },
      { status: 500 }
    );
  }
}
