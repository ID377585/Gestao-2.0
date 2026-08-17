#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

function requiredEnv(name, fallbacks = []) {
  for (const candidate of [name, ...fallbacks]) {
    const value = String(process.env[candidate] ?? "").trim();
    if (value) return value;
  }

  throw new Error(
    `Variável obrigatória ausente: ${[name, ...fallbacks].join(" ou ")}`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatError(error) {
  if (!error) return "erro desconhecido";

  return [error.message, error.code, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");
}

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]);
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const reportFile =
  process.env.GESTIFY_MEMBERSHIP_UNIQUENESS_REPORT_FILE ??
  ".artifacts/supabase-migration-smoke/membership-uniqueness-report.json";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const establishmentId = randomUUID();
  const email = `gestify-membership-${suffix}@example.test`;
  const password = `Gestify-Membership-${suffix}-A9!`;
  let userId = null;

  try {
    const { data: userData, error: userError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Gestify Membership Contract" },
        app_metadata: { role: "estoque" },
      });

    if (userError || !userData.user) {
      throw new Error(
        `Falha ao criar usuário do contrato: ${formatError(userError)}`
      );
    }

    userId = userData.user.id;

    const { error: establishmentError } = await admin
      .from("establishments")
      .insert({
        id: establishmentId,
        name: "Gestify Membership Contract",
        is_active: true,
      });

    if (establishmentError) {
      throw new Error(
        `Falha ao criar estabelecimento: ${formatError(establishmentError)}`
      );
    }

    const initialMembership = {
      establishment_id: establishmentId,
      user_id: userId,
      role: "estoque",
      is_active: true,
    };

    const { error: insertError } = await admin
      .from("establishment_memberships")
      .insert(initialMembership);

    if (insertError) {
      throw new Error(
        `Falha ao criar associação inicial: ${formatError(insertError)}`
      );
    }

    const { error: upsertError } = await admin
      .from("establishment_memberships")
      .upsert(
        {
          ...initialMembership,
          role: "operacao",
        },
        { onConflict: "establishment_id,user_id" }
      );

    if (upsertError) {
      throw new Error(
        `UPSERT idempotente não encontrou o contrato UNIQUE: ${formatError(
          upsertError
        )}`
      );
    }

    const { data: memberships, error: readError } = await admin
      .from("establishment_memberships")
      .select("id, establishment_id, user_id, role, is_active")
      .eq("establishment_id", establishmentId)
      .eq("user_id", userId);

    if (readError) {
      throw new Error(
        `Falha ao consultar associação: ${formatError(readError)}`
      );
    }

    assert(
      memberships?.length === 1,
      `Contrato de unicidade inválido: esperado 1 vínculo, recebido ${
        memberships?.length ?? 0
      }.`
    );
    assert(
      memberships[0]?.role === "operacao",
      "UPSERT idempotente não atualizou o vínculo existente."
    );

    const { error: duplicateError } = await admin
      .from("establishment_memberships")
      .insert({
        ...initialMembership,
        role: "admin",
      });

    const duplicateCode = String(duplicateError?.code ?? "");
    const duplicateText = formatError(duplicateError).toLowerCase();
    assert(
      duplicateCode === "23505" || duplicateText.includes("duplicate key"),
      `INSERT duplicado não foi bloqueado pelo banco: ${formatError(
        duplicateError
      )}`
    );

    const report = {
      format: "gestify-membership-uniqueness-v1",
      ok: true,
      uniqueColumns: ["establishment_id", "user_id"],
      idempotentUpsert: true,
      duplicateInsertBlocked: true,
      generatedAt: new Date().toISOString(),
    };

    writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (userId) {
      await admin
        .from("establishment_memberships")
        .delete()
        .eq("establishment_id", establishmentId)
        .eq("user_id", userId);
      await admin.from("establishments").delete().eq("id", establishmentId);
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

main().catch((error) => {
  console.error(`[membership-uniqueness] ${error.message}`);
  process.exit(1);
});
