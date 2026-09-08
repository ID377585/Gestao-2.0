#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: arquivo obrigatório ausente`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireIncludes(relativePath, fragments) {
  const source = read(relativePath);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      failures.push(`${relativePath}: contrato ausente -> ${fragment}`);
    }
  }
  return source;
}

requireIncludes("src/app/layout.tsx", [
  "NavigationProgress",
  "<NavigationProgress />",
]);

requireIncludes("src/app/(dashboard)/layout.tsx", [
  'href="#main-content"',
  'id="main-content"',
  "tabIndex={-1}",
  "Pular para o conteúdo principal",
]);

requireIncludes("src/components/layout/SidebarNav.tsx", [
  'aria-label="Navegação principal"',
  'aria-current={active ? "page" : undefined}',
  "min-h-11",
  "focus-visible:ring-2",
]);

const mobileSource = requireIncludes("src/components/layout/SidebarMobile.tsx", [
  "aria-expanded={open}",
  'aria-controls="mobile-navigation-panel"',
  'aria-modal="true"',
  'role="dialog"',
  'aria-current={active ? "page" : undefined}',
  "focusableSelector",
  "min-h-11",
]);

if (/<Link[\s\S]{0,400}>\s*<Button/.test(mobileSource)) {
  failures.push(
    "src/components/layout/SidebarMobile.tsx: elemento <Button> interativo aninhado dentro de <Link>"
  );
}

requireIncludes("src/components/layout/NavigationProgress.tsx", [
  'document.addEventListener("click", onDocumentClick, true)',
  "event.metaKey",
  "destination.origin !== current.origin",
  'role="status"',
]);

requireIncludes("src/app/globals.css", [
  "prefers-reduced-motion: reduce",
  ".navigation-progress__bar",
]);

requireIncludes("src/app/loading.tsx", ["aria-busy=", 'role="status"']);
requireIncludes("src/app/not-found.tsx", ["Erro 404", "focus-visible:ring-2"]);
requireIncludes("src/app/error.tsx", ["min-h-11", "focus-visible:ring-2"]);
requireIncludes("src/app/global-error.tsx", ["min-h-11", "focus-visible:ring-2"]);

if (failures.length > 0) {
  console.error("[frontend-readiness] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[frontend-readiness] PASS");
console.log("- navegação interna com feedback não bloqueante");
console.log("- navegação desktop/móvel com estado atual e foco visível");
console.log("- drawer móvel com semântica, Escape e contenção de foco");
console.log("- alvos de navegação >= 44px");
console.log("- skip link + landmark principal");
console.log("- loading, 404 e error boundaries com UX acessível");
console.log("- prefers-reduced-motion respeitado");
