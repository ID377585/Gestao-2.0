import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput,
} from "@/types/compras";

const COLLECTION_NAME = "suppliers";

function normalizeSupplier(
  id: string,
  data: Record<string, any>
): Supplier {
  return {
    id,
    razaoSocial: data.razaoSocial ?? "",
    nomeFantasia: data.nomeFantasia ?? "",
    cnpj: data.cnpj ?? "",
    contato: data.contato ?? "",
    telefone: data.telefone ?? "",
    email: data.email ?? "",
    endereco: data.endereco ?? "",
    observacoes: data.observacoes ?? "",
    ativo: data.ativo ?? true,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function createSupplier(
  input: CreateSupplierInput
): Promise<string> {
  const payload = {
    razaoSocial: input.razaoSocial.trim(),
    nomeFantasia: input.nomeFantasia?.trim() ?? "",
    cnpj: input.cnpj?.trim() ?? "",
    contato: input.contato?.trim() ?? "",
    telefone: input.telefone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    endereco: input.endereco?.trim() ?? "",
    observacoes: input.observacoes?.trim() ?? "",
    ativo: input.ativo ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION_NAME), payload);
  return ref.id;
}

export async function listSuppliers(): Promise<Supplier[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("razaoSocial", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) =>
    normalizeSupplier(docItem.id, docItem.data())
  );
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeSupplier(snapshot.id, snapshot.data());
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, id);

  const payload = {
    ...input,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, payload);
}

export async function toggleSupplierStatus(
  id: string,
  ativo: boolean
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    ativo,
    updatedAt: serverTimestamp(),
  });
}