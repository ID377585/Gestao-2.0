#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";
import ExcelJS from "exceljs";

const require = createRequire(import.meta.url);

function readResolvedPackageVersion(packageName, resolveFrom) {
  const entryPath = require.resolve(packageName, { paths: [resolveFrom] });
  let currentDirectory = dirname(entryPath);
  const rootDirectory = parse(currentDirectory).root;

  while (currentDirectory !== rootDirectory) {
    const packagePath = join(currentDirectory, "package.json");
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      if (packageJson.name === packageName) {
        return packageJson.version;
      }
    }
    currentDirectory = dirname(currentDirectory);
  }

  throw new Error(`Não foi possível localizar package.json de ${packageName}.`);
}

const excelJsPackagePath = require.resolve("exceljs/package.json");
const uuidVersion = readResolvedPackageVersion("uuid", dirname(excelJsPackagePath));
assert.equal(
  uuidVersion,
  "11.1.1",
  `ExcelJS deve resolver uuid 11.1.1; versão encontrada: ${uuidVersion}`
);

const sourceRows = [
  {
    product_name: "Chocolate 70%",
    unit_label: "KG",
    counted_quantity: 12.5,
    system_stock: 10.25,
    difference: 2.25,
    status: "DIVERGENTE",
  },
  {
    product_name: "Açúcar refinado",
    unit_label: "KG",
    counted_quantity: 8,
    system_stock: 8,
    difference: 0,
    status: "OK",
  },
];

const workbook = new ExcelJS.Workbook();
workbook.creator = "Gestify CI";
workbook.created = new Date("2026-08-10T00:00:00.000Z");

const sheet = workbook.addWorksheet("Inventário");
sheet.columns = [
  { header: "Produto", key: "product_name", width: 32 },
  { header: "Unidade", key: "unit_label", width: 10 },
  { header: "Quantidade Contada", key: "counted_quantity", width: 22 },
  { header: "Estoque Sistema", key: "system_stock", width: 18 },
  { header: "Diferença", key: "difference", width: 12 },
  { header: "Status", key: "status", width: 15 },
];

sheet.addRows(sourceRows);
sheet.getRow(1).font = { bold: true };
sheet.getColumn(3).numFmt = "0.00";
sheet.getColumn(4).numFmt = "0.00";
sheet.getColumn(5).numFmt = "0.00";
sheet.views = [{ state: "frozen", ySplit: 1 }];

const generated = Buffer.from(await workbook.xlsx.writeBuffer());
assert.ok(generated.length > 1000, "O arquivo XLSX gerado está inesperadamente vazio.");
assert.equal(
  generated.subarray(0, 2).toString("hex"),
  "504b",
  "O arquivo XLSX não possui a assinatura ZIP esperada."
);

const base64 = generated.toString("base64");
const decoded = Buffer.from(base64, "base64");
assert.equal(decoded.length, generated.length, "A conversão base64 alterou o tamanho do XLSX.");
assert.deepEqual(
  decoded.subarray(0, 16),
  generated.subarray(0, 16),
  "A conversão base64 alterou o conteúdo do XLSX."
);

const restoredWorkbook = new ExcelJS.Workbook();
await restoredWorkbook.xlsx.load(decoded);

assert.equal(restoredWorkbook.worksheets.length, 1, "Quantidade inesperada de planilhas.");
const restoredSheet = restoredWorkbook.getWorksheet("Inventário");
assert.ok(restoredSheet, "A planilha Inventário não foi restaurada.");
assert.equal(restoredSheet.rowCount, 3, "A exportação não preservou cabeçalho e duas linhas.");

assert.deepEqual(
  restoredSheet.getRow(1).values.slice(1),
  [
    "Produto",
    "Unidade",
    "Quantidade Contada",
    "Estoque Sistema",
    "Diferença",
    "Status",
  ],
  "Os cabeçalhos da exportação foram alterados."
);

assert.equal(restoredSheet.getCell("A2").value, sourceRows[0].product_name);
assert.equal(restoredSheet.getCell("B2").value, sourceRows[0].unit_label);
assert.equal(restoredSheet.getCell("C2").value, sourceRows[0].counted_quantity);
assert.equal(restoredSheet.getCell("D2").value, sourceRows[0].system_stock);
assert.equal(restoredSheet.getCell("E2").value, sourceRows[0].difference);
assert.equal(restoredSheet.getCell("F2").value, sourceRows[0].status);
assert.equal(restoredSheet.getCell("F3").value, sourceRows[1].status);

assert.equal(restoredSheet.getCell("A1").font.bold, true, "Cabeçalho deixou de ser negrito.");
assert.equal(restoredSheet.getCell("C2").numFmt, "0.00", "Formato numérico C foi alterado.");
assert.equal(restoredSheet.getCell("D2").numFmt, "0.00", "Formato numérico D foi alterado.");
assert.equal(restoredSheet.getCell("E2").numFmt, "0.00", "Formato numérico E foi alterado.");
assert.equal(restoredSheet.views[0]?.state, "frozen", "Congelamento do cabeçalho foi perdido.");
assert.equal(restoredSheet.views[0]?.ySplit, 1, "Linha congelada inesperada.");

console.log(
  `[excel-smoke] OK: ExcelJS 4.4.0 + uuid ${uuidVersion}; ` +
    `${sourceRows.length} linhas; ${generated.length} bytes; round-trip XLSX/base64 aprovado.`
);
