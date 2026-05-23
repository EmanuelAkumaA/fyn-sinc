import { supabase } from "@/integrations/supabase/client";
import { getCurrentOrgIdLocal } from "@/lib/current-org";

export async function getCurrentOrgId(): Promise<string | null> {
  const local = getCurrentOrgIdLocal();
  if (local) return local;
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data } = await supabase
    .from("organization_users")
    .select("organization_id")
    .eq("user_id", userRes.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export function formatBRL(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

export type RecurrenceFreq = "semanal" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual";

export const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export function addPeriod(dateStr: string, freq: RecurrenceFreq): string {
  const d = new Date(dateStr + "T00:00:00");
  switch (freq) {
    case "semanal": d.setDate(d.getDate() + 7); break;
    case "quinzenal": d.setDate(d.getDate() + 15); break;
    case "mensal": d.setMonth(d.getMonth() + 1); break;
    case "trimestral": d.setMonth(d.getMonth() + 3); break;
    case "semestral": d.setMonth(d.getMonth() + 6); break;
    case "anual": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Avança a partir de `dateStr` respeitando a frequência e mantendo o dia ancorado.
 * Se `anchorDay` não existir no mês resultante, usa o último dia daquele mês.
 * Frequências em dias (semanal/quinzenal) ignoram o anchorDay.
 */
export function nextAnchoredDate(
  dateStr: string,
  freq: RecurrenceFreq,
  anchorDay: number | null | undefined,
): string {
  const d = new Date(dateStr + "T00:00:00");
  if (freq === "semanal") { d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
  if (freq === "quinzenal") { d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10); }

  const monthsMap: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
  const add = monthsMap[freq] ?? 1;

  const totalMonths = d.getFullYear() * 12 + d.getMonth() + add;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const anchor = anchorDay ?? d.getDate();
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(anchor, lastDay);
  const result = new Date(targetYear, targetMonth, day);
  return result.toISOString().slice(0, 10);
}

export const PLATFORMS = [
  "Google Ads",
  "Meta Ads",
  "TikTok Ads",
  "LinkedIn Ads",
  "Ferramenta",
  "Outro",
] as const;
