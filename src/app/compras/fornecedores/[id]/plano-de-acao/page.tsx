"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { buildCreatedByLabel, getCurrentUserInfo } from "@/lib/auth/current-user";
import { getSupplierById } from "@/lib/compras/suppliers";
import {
  createSupplierActionPlanItem,
  createSupplierContactHistory,
  createSupplierScoreReview,
  listSupplierActionPlanItems,
  listSupplierContactHistory,
  listSupplierScoreReviews,
  updateSupplierActionPlanStatus,
  updateSupplierScoreReviewStatus,
} from "@/lib/compras/supplier-action-plan";
import type {
  Supplier,
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

function categoryLabel(category: SupplierActionPlanItem["category"]) {
  switch (category) {
    case "comercial":
      return "Comercial";
    case "operacional":
      return "Operacional";
    case "financeiro":
      return "Financeiro";
    case "qualidade":
      return "Qualidade";
    default:
      return category;
  }
}

function statusLabel(status: SupplierActionPlanItem["status"]) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "em_andamento":
      return "Em andamento";
    case "concluido":
      return "Concluído";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

function reviewStatusLabel(status: SupplierScoreReviewItem["status"]) {
  switch (status) {
    case "agendada":
      return "Agendada";
    case "realizada":
      return "Realizada";
    case "cancelada":
      return "Cancelada";
    default:
      return status;
  }
}

function contactTypeLabel(type: SupplierContactHistoryItem["contactType"]) {
  switch (type) {
    case "ligacao":
      return "Ligação";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "E-mail";
    case "reuniao":
      return "Reunião";
    case "visita":
      return "Visita";
    default:
      return type;
  }
}

export default function SupplierActionPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [actions, setActions] = useState<SupplierActionPlanItem[]>([]);
  const [contacts, setContacts] = useState<SupplierContactHistoryItem[]>([]);
  const [reviews, setReviews] = useState<SupplierScoreReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingAction, setSavingAction] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const [actionForm, setActionForm] = useState({
    title: "",
    description: "",
    category: "operacional" as SupplierActionPlanItem["category"],
    priority: "media" as SupplierActionPlanItem["priority"],
    dueDate: "",
    assignedTo: "",
  });

  const [contactForm, setContactForm] = useState({
    contactType: "email" as SupplierContactHistoryItem["contactType"],
    subject: "",
    notes: "",
    contactDate: new Date().toISOString().slice(0, 10),
    nextFollowUpDate: "",
  });

  const [reviewForm, setReviewForm] = useState({
    scheduledDate: "",
    notes: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const supplierData = await getSupplierById(supplierId);

      if (!supplierData) {
        setError("Fornecedor não encontrado.");
        setLoading(false);
        return;
      }

      const [actionItems, contactItems, reviewItems] = await Promise.all([
        listSupplierActionPlanItems(supplierId),
        listSupplierContactHistory(supplierId),
        listSupplierScoreReviews(supplierId),
      ]);

      setSupplier(supplierData);
      setActions(actionItems);
      setContacts(contactItems);
      setReviews(reviewItems);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o plano de ação.");
    } finally {
      setLoading(false);
    }
  }

  async function getActor() {
    const currentUser = await getCurrentUserInfo();
    return buildCreatedByLabel(currentUser);
  }

  async function handleCreateAction() {
    if (!supplier) return;
    if (!actionForm.title.trim()) {
      alert("Informe o título da ação.");
      return;
    }

    try {
      setSavingAction(true);

      await createSupplierActionPlanItem({
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
        title: actionForm.title,
        description: actionForm.description,
        category: actionForm.category,
        priority: actionForm.priority,
        dueDate: actionForm.dueDate,
        assignedTo: actionForm.assignedTo,
        createdBy: await getActor(),
      });

      setActionForm({
        title: "",
        description: "",
        category: "operacional",
        priority: "media",
        dueDate: "",
        assignedTo: "",
      });

      await loadData();
    } catch (err) {
      console.error(err);
      alert("Não foi possível criar a ação.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleCreateContact() {
    if (!supplier) return;
    if (!contactForm.subject.trim()) {
      alert("Informe o assunto do contato.");
      return;
    }

    try {
      setSavingContact(true);

      await createSupplierContactHistory({
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
        contactType: contactForm.contactType,
        subject: contactForm.subject,
        notes: contactForm.notes,
        contactDate: contactForm.contactDate,
        nextFollowUpDate: contactForm.nextFollowUpDate,
        createdBy: await getActor(),
      });

      setContactForm({
        contactType: "email",
        subject: "",
        notes: "",
        contactDate: new Date().toISOString().slice(0, 10),
        nextFollowUpDate: "",
      });

      await loadData();
    } catch (err) {
      console.error(err);
      alert("Não foi possível registrar o contato.");
    } finally {
      setSavingContact(false);
    }
  }

  async function handleCreateReview() {
    if (!supplier) return;
    if (!reviewForm.scheduledDate) {
      alert("Informe a data de reavaliação.");
      return;
    }

    try {
      setSavingReview(true);

      await createSupplierScoreReview({
        supplierId: supplier.id,
        supplierName: supplier.razaoSocial,
        scheduledDate: reviewForm.scheduledDate,
        notes: reviewForm.notes,
        createdBy: await getActor(),
      });

      setReviewForm({
        scheduledDate: "",
        notes: "",
      });

      await loadData();
    } catch (err) {
      console.error(err);
      alert("Não foi possível criar a reavaliação.");
    } finally {
      setSavingReview(false);
    }
  }

  useEffect(() => {
    if (supplierId) {
      loadData();
    }
  }, [supplierId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando plano de ação...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Fornecedor não encontrado."}
        </p>
        <button
          onClick={() => router.push("/compras/fornecedores")}
          className="rounded-xl border px-4 py-2 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plano de ação</h1>
          <p className="text-sm text-gray-500">{supplier.razaoSocial}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/compras/fornecedores/${supplier.id}`}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Ficha do fornecedor
          </Link>

          <Link
            href="/compras/fornecedores"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Voltar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Nova ação</h2>

          <div className="space-y-3">
            <input
              value={actionForm.title}
              onChange={(e) => setActionForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Título da ação"
            />

            <textarea
              value={actionForm.description}
              onChange={(e) =>
                setActionForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Descrição"
            />

            <select
              value={actionForm.category}
              onChange={(e) =>
                setActionForm((prev) => ({
                  ...prev,
                  category: e.target.value as SupplierActionPlanItem["category"],
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="comercial">Comercial</option>
              <option value="operacional">Operacional</option>
              <option value="financeiro">Financeiro</option>
              <option value="qualidade">Qualidade</option>
            </select>

            <select
              value={actionForm.priority}
              onChange={(e) =>
                setActionForm((prev) => ({
                  ...prev,
                  priority: e.target.value as SupplierActionPlanItem["priority"],
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>

            <input
              type="date"
              value={actionForm.dueDate}
              onChange={(e) => setActionForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />

            <input
              value={actionForm.assignedTo}
              onChange={(e) =>
                setActionForm((prev) => ({ ...prev, assignedTo: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Responsável"
            />

            <button
              type="button"
              onClick={handleCreateAction}
              disabled={savingAction}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingAction ? "Salvando..." : "Salvar ação"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Novo contato</h2>

          <div className="space-y-3">
            <select
              value={contactForm.contactType}
              onChange={(e) =>
                setContactForm((prev) => ({
                  ...prev,
                  contactType: e.target.value as SupplierContactHistoryItem["contactType"],
                }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="reuniao">Reunião</option>
              <option value="visita">Visita</option>
            </select>

            <input
              value={contactForm.subject}
              onChange={(e) => setContactForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Assunto"
            />

            <textarea
              value={contactForm.notes}
              onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Anotações"
            />

            <input
              type="date"
              value={contactForm.contactDate}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, contactDate: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />

            <input
              type="date"
              value={contactForm.nextFollowUpDate}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, nextFollowUpDate: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />

            <button
              type="button"
              onClick={handleCreateContact}
              disabled={savingContact}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingContact ? "Salvando..." : "Registrar contato"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Reavaliação de score</h2>

          <div className="space-y-3">
            <input
              type="date"
              value={reviewForm.scheduledDate}
              onChange={(e) =>
                setReviewForm((prev) => ({ ...prev, scheduledDate: e.target.value }))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />

            <textarea
              value={reviewForm.notes}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="min-h-[100px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Observações"
            />

            <button
              type="button"
              onClick={handleCreateReview}
              disabled={savingReview}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingReview ? "Salvando..." : "Agendar reavaliação"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Checklist / plano de ação</h2>

        {actions.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma ação cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {actions.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {categoryLabel(item.category)} • {statusLabel(item.status)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateSupplierActionPlanStatus({
                          id: item.id,
                          status: "em_andamento",
                        }).then(loadData)
                      }
                      className="rounded-lg border px-3 py-1 text-xs font-medium"
                    >
                      Em andamento
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateSupplierActionPlanStatus({
                          id: item.id,
                          status: "concluido",
                        }).then(loadData)
                      }
                      className="rounded-lg border px-3 py-1 text-xs font-medium"
                    >
                      Concluir
                    </button>
                  </div>
                </div>

                {item.description ? (
                  <div className="mt-2 text-sm text-gray-700">{item.description}</div>
                ) : null}

                <div className="mt-2 text-xs text-gray-500">
                  Responsável: {item.assignedTo || "-"} • Prazo: {item.dueDate || "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Histórico de contato</h2>

          {contacts.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum contato registrado.</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="font-medium">{item.subject}</div>
                  <div className="text-sm text-gray-500">
                    {contactTypeLabel(item.contactType)} • {item.contactDate || "-"}
                  </div>

                  {item.notes ? (
                    <div className="mt-2 text-sm text-gray-700">{item.notes}</div>
                  ) : null}

                  <div className="mt-2 text-xs text-gray-500">
                    Próximo follow-up: {item.nextFollowUpDate || "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Agenda de reavaliação</h2>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma reavaliação agendada.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{item.scheduledDate}</div>
                      <div className="text-sm text-gray-500">
                        {reviewStatusLabel(item.status)}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateSupplierScoreReviewStatus({
                            id: item.id,
                            status: "realizada",
                          }).then(loadData)
                        }
                        className="rounded-lg border px-3 py-1 text-xs font-medium"
                      >
                        Realizada
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateSupplierScoreReviewStatus({
                            id: item.id,
                            status: "cancelada",
                          }).then(loadData)
                        }
                        className="rounded-lg border px-3 py-1 text-xs font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>

                  {item.notes ? (
                    <div className="mt-2 text-sm text-gray-700">{item.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}