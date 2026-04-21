"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type FichaTecnica = {
  id: string;
  nome?: string;
  rendimento?: number;
  custoTotal?: number;
  ativo?: boolean;
};

type Etiqueta = {
  id: string;
  nome?: string;
  createdAt?: string;
};

function toIsoDate(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") return value;

  if (value instanceof Date) return value.toISOString();

  return "";
}

export default function EngenhariaDashboardPage() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [fichasRes, etiquetasRes] = await Promise.all([
        supabase.from("technicalSheets").select("*"),
        supabase.from("labels").select("*"),
      ]);

      if (fichasRes.error) throw fichasRes.error;
      if (etiquetasRes.error) throw etiquetasRes.error;

      setFichas(
        (fichasRes.data ?? []).map((item: any) => ({
          id: String(item.id),
          nome: item.nome ?? "",
          rendimento: Number(item.rendimento ?? 0),
          custoTotal: Number(item.custoTotal ?? 0),
          ativo: item.ativo ?? true,
        }))
      );

      setEtiquetas(
        (etiquetasRes.data ?? []).map((item: any) => ({
          id: String(item.id),
          nome: item.nome ?? "",
          createdAt: toIsoDate(item.createdAt ?? item.created_at),
        }))
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o dashboard de engenharia.");
    } finally {
      setLoading(false);
    }
  }, []);

  const metrics = useMemo(() => {
    const ativas = fichas.filter((item) => item.ativo !== false);

    return {
      fichas: ativas.length,
      rendimentoZero: ativas.filter((item) => Number(item.rendimento ?? 0) <= 0).length,
      semCusto: ativas.filter((item) => Number(item.custoTotal ?? 0) <= 0).length,
      etiquetas: etiquetas.length,
    };
  }, [fichas, etiquetas]);

  const fichasCriticas = useMemo(() => {
    return fichas
      .filter((item) => item.ativo !== false)
      .filter(
        (item) =>
          Number(item.rendimento ?? 0) <= 0 || Number(item.custoTotal ?? 0) <= 0
      )
      .slice(0, 10);
  }, [fichas]);

  const ultimasEtiquetas = useMemo(() => {
    return [...etiquetas]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 10);
  }, [etiquetas]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Engenharia</h1>
          <p className="text-sm text-gray-500">
            Visão executiva de fichas técnicas e etiquetas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/fichas-tecnicas"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Fichas técnicas
          </Link>
          <Link
            href="/dashboard/etiquetas"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Etiquetas
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Carregando dashboard...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Fichas técnicas</div>
              <div className="mt-2 text-2xl font-bold">{metrics.fichas}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Rendimento zerado</div>
              <div className="mt-2 text-2xl font-bold">{metrics.rendimentoZero}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Sem custo</div>
              <div className="mt-2 text-2xl font-bold">{metrics.semCusto}</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Etiquetas</div>
              <div className="mt-2 text-2xl font-bold">{metrics.etiquetas}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Fichas críticas</h2>

              {fichasCriticas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma ficha crítica.</p>
              ) : (
                <div className="space-y-3">
                  {fichasCriticas.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border px-4 py-3"
                    >
                      <div className="font-medium">{item.nome || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Rendimento: {Number(item.rendimento ?? 0)} • Custo: {Number(item.custoTotal ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Últimas etiquetas</h2>

              {ultimasEtiquetas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma etiqueta encontrada.</p>
              ) : (
                <div className="space-y-3">
                  {ultimasEtiquetas.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border px-4 py-3"
                    >
                      <div className="font-medium">{item.nome || "-"}</div>
                      <div className="text-xs text-gray-500">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString("pt-BR")
                          : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}