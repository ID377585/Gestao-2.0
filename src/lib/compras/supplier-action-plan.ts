import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  SupplierActionPlanItem,
  SupplierContactHistoryItem,
  SupplierScoreReviewItem,
} from "@/types/compras";

const ACTION_PLAN_COLLECTION = "supplierActionPlans";
const CONTACT_HISTORY_COLLECTION = "supplierContactHistory";
const SCORE_REVIEW_COLLECTION = "supplierScoreReviews";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeActionPlanItem(
  id: string,
  data: Record<string, any>
): SupplierActionPlanItem {
  return {
    id,
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    title: data.title ?? "",
    description: data.description ?? "",
    category: data.category ?? "operacional",
    status: data.status ?? "pendente",
    priority: data.priority ?? "media",
    dueDate: data.dueDate ?? "",
    assignedTo: data.assignedTo ?? "",
    createdBy: data.createdBy ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function normalizeContactHistoryItem(
  id: string,
  data: Record<string, any>
): SupplierContactHistoryItem {
  return {
    id,
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    contactType: data.contactType ?? "email",
    subject: data.subject ?? "",
    notes: data.notes ?? "",
    contactDate: data.contactDate ?? "",
    nextFollowUpDate: data.nextFollowUpDate ?? "",
    createdBy: data.createdBy ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

function normalizeScoreReviewItem(
  id: string,
  data: Record<string, any>
): SupplierScoreReviewItem {
  return {
    id,
    supplierId: data.supplierId ?? "",
    supplierName: data.supplierName ?? "",
    scheduledDate: data.scheduledDate ?? "",
    notes: data.notes ?? "",
    status: data.status ?? "agendada",
    createdBy: data.createdBy ?? "",
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

export async function listSupplierActionPlanItems(supplierId: string) {
  const q = query(
    collection(db, ACTION_PLAN_COLLECTION),
    where("supplierId", "==", supplierId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    normalizeActionPlanItem(item.id, item.data())
  );
}

export async function createSupplierActionPlanItem(input: {
  supplierId: string;
  supplierName: string;
  title: string;
  description?: string;
  category: SupplierActionPlanItem["category"];
  status?: SupplierActionPlanItem["status"];
  priority: SupplierActionPlanItem["priority"];
  dueDate?: string;
  assignedTo?: string;
  createdBy?: string;
}) {
  const ref = doc(collection(db, ACTION_PLAN_COLLECTION));

  await setDoc(ref, {
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    title: input.title,
    description: input.description ?? "",
    category: input.category,
    status: input.status ?? "pendente",
    priority: input.priority,
    dueDate: input.dueDate ?? "",
    assignedTo: input.assignedTo ?? "",
    createdBy: input.createdBy ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateSupplierActionPlanStatus(params: {
  id: string;
  status: SupplierActionPlanItem["status"];
}) {
  const ref = doc(db, ACTION_PLAN_COLLECTION, params.id);

  await updateDoc(ref, {
    status: params.status,
    updatedAt: serverTimestamp(),
  });
}

export async function listSupplierContactHistory(supplierId: string) {
  const q = query(
    collection(db, CONTACT_HISTORY_COLLECTION),
    where("supplierId", "==", supplierId),
    orderBy("contactDate", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    normalizeContactHistoryItem(item.id, item.data())
  );
}

export async function createSupplierContactHistory(input: {
  supplierId: string;
  supplierName: string;
  contactType: SupplierContactHistoryItem["contactType"];
  subject: string;
  notes?: string;
  contactDate: string;
  nextFollowUpDate?: string;
  createdBy?: string;
}) {
  const ref = doc(collection(db, CONTACT_HISTORY_COLLECTION));

  await setDoc(ref, {
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    contactType: input.contactType,
    subject: input.subject,
    notes: input.notes ?? "",
    contactDate: input.contactDate,
    nextFollowUpDate: input.nextFollowUpDate ?? "",
    createdBy: input.createdBy ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function listSupplierScoreReviews(supplierId: string) {
  const q = query(
    collection(db, SCORE_REVIEW_COLLECTION),
    where("supplierId", "==", supplierId),
    orderBy("scheduledDate", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    normalizeScoreReviewItem(item.id, item.data())
  );
}

export async function createSupplierScoreReview(input: {
  supplierId: string;
  supplierName: string;
  scheduledDate: string;
  notes?: string;
  createdBy?: string;
}) {
  const ref = doc(collection(db, SCORE_REVIEW_COLLECTION));

  await setDoc(ref, {
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    scheduledDate: input.scheduledDate,
    notes: input.notes ?? "",
    status: "agendada",
    createdBy: input.createdBy ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateSupplierScoreReviewStatus(params: {
  id: string;
  status: SupplierScoreReviewItem["status"];
}) {
  const ref = doc(db, SCORE_REVIEW_COLLECTION, params.id);

  await updateDoc(ref, {
    status: params.status,
    updatedAt: serverTimestamp(),
  });
}