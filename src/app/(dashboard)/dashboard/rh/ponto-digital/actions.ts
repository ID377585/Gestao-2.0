"use server";

import { revalidatePath } from "next/cache";

import {
  getTimeClockDashboardData,
  registerNextTimeClockEvent,
  saveTimeClockSettings,
} from "@/lib/hr/time-clock.server";
import type {
  TimeClockActionResult,
  TimeClockDashboardData,
  TimeClockEventType,
  TimeClockSettingsInput,
} from "@/lib/hr/time-clock-types";

function eventSuccessMessage(eventType: TimeClockEventType) {
  switch (eventType) {
    case "clock_in":
      return "Entrada registrada com o horário do servidor.";
    case "break_start":
      return "Início do intervalo registrado.";
    case "break_end":
      return "Retorno do intervalo registrado.";
    case "clock_out":
      return "Saída registrada e jornada encerrada.";
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export async function refreshTimeClockAction(): Promise<
  | { ok: true; data: TimeClockDashboardData }
  | { ok: false; error: string }
> {
  try {
    return {
      ok: true,
      data: await getTimeClockDashboardData(),
    };
  } catch (error) {
    console.error("[refreshTimeClockAction] erro:", error);
    return { ok: false, error: errorMessage(error) };
  }
}

export async function registerNextTimeClockEventAction(): Promise<TimeClockActionResult> {
  try {
    const result = await registerNextTimeClockEvent();
    revalidatePath("/dashboard/rh/ponto-digital");

    return {
      ok: true,
      data: result.data,
      message: eventSuccessMessage(result.eventType),
    };
  } catch (error) {
    console.error("[registerNextTimeClockEventAction] erro:", error);
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveTimeClockSettingsAction(
  input: TimeClockSettingsInput
): Promise<TimeClockActionResult> {
  try {
    const data = await saveTimeClockSettings(input);
    revalidatePath("/dashboard/rh/ponto-digital");

    return {
      ok: true,
      data,
      message: "Configurações de jornada salvas.",
    };
  } catch (error) {
    console.error("[saveTimeClockSettingsAction] erro:", error);
    return { ok: false, error: errorMessage(error) };
  }
}
