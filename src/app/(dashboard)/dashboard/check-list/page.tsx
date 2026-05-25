import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  blockChecklistRun,
  cancelChecklistRun,
  completeChecklistRun,
  createChecklistRun,
  getChecklistDashboard,
  updateChecklistRunItem,
  type ChecklistItemStatus,
  type ChecklistShift,
  type KitchenChecklistRunItem,
} from "./actions";

const shiftLabels: Record<string, string> = {
  opening: "Abertura",
  closing: "Fechamento",
  any: "Geral",
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  ok: "OK",
  not_ok: "Não OK",
  not_applicable: "Não aplicável",
  corrected: "Corrigido",
};

const categoryLabels: Record<string, string> = {
  abertura: "Abertura",
  fechamento: "Fechamento",
  seguranca_alimentar: "Segurança alimentar",
  equipamentos: "Equipamentos",
  temperatura: "Temperatura",
  limpeza: "Limpeza",
  oleo: "Óleo",
  validade: "Validade",
  pv_ps: "PV-PS",
  perdas: "Perdas",
  producao: "Produção",
  compras: "Compras",
  estoque: "Estoque",
  outros: "Outros",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function templateFromRunItem(item: KitchenChecklistRunItem) {
  const raw = item.template_item as any;
  return Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
}

function badgeClass(status: string) {
  if (status === "ok") return "bg-emerald-600 text-white";
  if (status === "not_ok") return "bg-red-600 text-white";
  if (status === "corrected") return "bg-blue-600 text-white";
  if (status === "not_applicable") return "bg-slate-500 text-white";
  if (status === "blocked") return "bg-orange-600 text-white";
  if (status === "cancelled") return "bg-slate-700 text-white";
  if (status === "completed") return "bg-emerald-700 text-white";
  return "bg-yellow-500 text-white";
}

async function openRunAction(formData: FormData) {
  "use server";
  const templateId = String(formData.get("template_id") ?? "");
  const shift = String(formData.get("shift") ?? "opening") as ChecklistShift;
  await createChecklistRun(templateId, shift);
}

async function updateItemAction(formData: FormData) {
  "use server";
  await updateChecklistRunItem({
    runItemId: String(formData.get("run_item_id") ?? ""),
    status: String(formData.get("status") ?? "pending") as ChecklistItemStatus,
    measured_temperature: String(formData.get("measured_temperature") ?? "") || null,
    quantity: String(formData.get("quantity") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    corrective_action: String(formData.get("corrective_action") ?? "") || null,
  });
}

async function completeRunAction(formData: FormData) {
  "use server";
  await completeChecklistRun(
    String(formData.get("run_id") ?? ""),
    String(formData.get("notes") ?? "") || undefined,
  );
}

async function blockRunAction(formData: FormData) {
  "use server";
  await blockChecklistRun(
    String(formData.get("run_id") ?? ""),
    String(formData.get("notes") ?? "") || undefined,
  );
}

async function cancelRunAction(formData: FormData) {
  "use server";
  await cancelChecklistRun(
    String(formData.get("run_id") ?? ""),
    String(formData.get("notes") ?? "") || undefined,
  );
}

export default async function CheckListPage() {
  const data = await getChecklistDashboard();
  const activeRun = data.activeRun;
  const activeItems = data.activeRunItems;
  const pendingCount = activeItems.filter((item) => item.status === "pending").length;
  const doneCount = activeItems.length - pendingCount;

  const groups = activeItems.reduce<Record<string, KitchenChecklistRunItem[]>>((acc, item) => {
    const template = templateFromRunItem(item);
    const category = template?.category ?? "outros";
    acc[category] = acc[category] ?? [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check-List</h1>
        <p className="text-sm text-muted-foreground">
          Lista de verificação para abertura, fechamento, segurança alimentar, limpeza,
          temperatura, validade, PV-PS, produção, perdas, compras e estoque.
        </p>
      </div>

      {!activeRun ? (
        <Card>
          <CardHeader>
            <CardTitle>Abrir checklist</CardTitle>
            <CardDescription>Selecione o template e o turno para iniciar uma execução.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={openRunAction} className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
              <div className="space-y-2">
                <Label>Template</Label>
                <select name="template_id" className="h-10 rounded-md border bg-background px-3 text-sm">
                  {data.templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <select name="shift" className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue="opening">
                  <option value="opening">Abertura</option>
                  <option value="closing">Fechamento</option>
                  <option value="any">Geral</option>
                  <option value="morning">Manhã</option>
                  <option value="afternoon">Tarde</option>
                  <option value="night">Noite</option>
                </select>
              </div>
              <Button type="submit">Abrir Check-List</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {activeRun ? (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardHeader><CardDescription>Status</CardDescription><CardTitle>{activeRun.status}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Turno</CardDescription><CardTitle>{shiftLabels[activeRun.shift]}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Progresso</CardDescription><CardTitle>{doneCount}/{activeItems.length}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Aberta em</CardDescription><CardTitle className="text-base">{formatDateTime(activeRun.opened_at)}</CardTitle></CardHeader></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Controle da execução</CardTitle>
              <CardDescription>
                Conclua a checklist quando todos os itens estiverem conferidos. Para bloquear ou cancelar,
                informe um motivo para auditoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <form action={completeRunAction} className="space-y-3 rounded-md border p-3">
                <input type="hidden" name="run_id" value={activeRun.id} />
                <Label>Observação final</Label>
                <Textarea name="notes" placeholder="Resumo final do turno" />
                <Button type="submit" disabled={pendingCount > 0}>Concluir Check-List</Button>
                {pendingCount > 0 ? (
                  <p className="text-xs text-muted-foreground">Ainda existem {pendingCount} item(ns) pendente(s).</p>
                ) : null}
              </form>

              <form action={blockRunAction} className="space-y-3 rounded-md border p-3">
                <input type="hidden" name="run_id" value={activeRun.id} />
                <Label>Motivo do bloqueio</Label>
                <Textarea name="notes" required placeholder="Ex.: câmara fria em manutenção, falta de responsável, auditoria em andamento" />
                <Button type="submit" variant="secondary">Bloquear execução</Button>
              </form>

              <form action={cancelRunAction} className="space-y-3 rounded-md border p-3">
                <input type="hidden" name="run_id" value={activeRun.id} />
                <Label>Motivo do cancelamento</Label>
                <Textarea name="notes" required placeholder="Ex.: checklist aberta no turno errado ou por engano" />
                <Button type="submit" variant="destructive">Cancelar execução</Button>
              </form>
            </CardContent>
          </Card>

          {Object.entries(groups).map(([category, items]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{categoryLabels[category] ?? category}</h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>

              {items.map((item) => {
                const template = templateFromRunItem(item);
                return (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <CardTitle className="text-base">{template?.title ?? "Item"}</CardTitle>
                          <CardDescription>{template?.instructions ?? "Sem instruções."}</CardDescription>
                        </div>
                        <Badge className={badgeClass(item.status)}>{statusLabels[item.status]}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <form action={updateItemAction} className="space-y-4">
                        <input type="hidden" name="run_item_id" value={item.id} />
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <select name="status" defaultValue={item.status} className="h-10 rounded-md border bg-background px-3 text-sm">
                              <option value="pending">Pendente</option>
                              <option value="ok">OK</option>
                              <option value="not_ok">Não OK</option>
                              <option value="corrected">Corrigido</option>
                              <option value="not_applicable">Não aplicável</option>
                            </select>
                          </div>
                          {template?.requires_temperature ? (
                            <div className="space-y-2">
                              <Label>Temperatura</Label>
                              <Input name="measured_temperature" defaultValue={item.measured_temperature ?? ""} placeholder="Ex.: 4" />
                            </div>
                          ) : null}
                          {template?.requires_quantity ? (
                            <div className="space-y-2">
                              <Label>Quantidade</Label>
                              <Input name="quantity" defaultValue={item.quantity ?? ""} placeholder="Ex.: 2" />
                            </div>
                          ) : null}
                          <div className="space-y-2">
                            <Label>Conferido em</Label>
                            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{formatDateTime(item.checked_at)}</div>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Textarea name="notes" defaultValue={item.notes ?? ""} placeholder="Observações" />
                          <Textarea name="corrective_action" defaultValue={item.corrective_action ?? ""} placeholder="Ação corretiva" />
                        </div>
                        <Button type="submit">Salvar item</Button>
                      </form>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Histórico recente</CardTitle>
          <CardDescription>Últimas execuções registradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentRuns.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p> : null}
          {data.recentRuns.map((run) => (
            <div key={run.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{shiftLabels[run.shift]} · {formatDateTime(run.opened_at)}</div>
                <div className="text-muted-foreground">Concluída em {formatDateTime(run.completed_at)}</div>
                {run.notes ? <div className="mt-1 text-muted-foreground">Obs.: {run.notes}</div> : null}
              </div>
              <Badge className={badgeClass(run.status)}>{run.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
