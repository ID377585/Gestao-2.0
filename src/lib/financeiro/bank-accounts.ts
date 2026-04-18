import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  BankAccount,
  CreateBankAccountInput,
} from "@/types/compras";

const COLLECTION_NAME = "bankAccounts";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeBankAccount(
  id: string,
  data: Record<string, any>
): BankAccount {
  return {
    id,
    banco: data.banco ?? "",
    nomeConta: data.nomeConta ?? "",
    agencia: data.agencia ?? "",
    numeroConta: data.numeroConta ?? "",
    tipo: data.tipo ?? "corrente",
    saldoInicial: Number(data.saldoInicial ?? 0),
    ativo: Boolean(data.ativo ?? true),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("banco", "asc"),
    orderBy("nomeConta", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    normalizeBankAccount(item.id, item.data())
  );
}

export async function getBankAccountById(
  id: string
): Promise<BankAccount | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeBankAccount(snapshot.id, snapshot.data());
}

export async function createBankAccount(input: CreateBankAccountInput) {
  const ref = doc(collection(db, COLLECTION_NAME));

  await setDoc(ref, {
    banco: input.banco,
    nomeConta: input.nomeConta,
    agencia: input.agencia ?? "",
    numeroConta: input.numeroConta ?? "",
    tipo: input.tipo,
    saldoInicial: Number(input.saldoInicial ?? 0),
    ativo: input.ativo ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateBankAccount(params: {
  id: string;
  banco: string;
  nomeConta: string;
  agencia?: string;
  numeroConta?: string;
  tipo: "corrente" | "poupanca" | "caixa";
  saldoInicial: number;
  ativo: boolean;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    banco: params.banco,
    nomeConta: params.nomeConta,
    agencia: params.agencia ?? "",
    numeroConta: params.numeroConta ?? "",
    tipo: params.tipo,
    saldoInicial: Number(params.saldoInicial ?? 0),
    ativo: params.ativo,
    updatedAt: serverTimestamp(),
  });
}