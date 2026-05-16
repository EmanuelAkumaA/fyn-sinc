import { supabase } from "@/integrations/supabase/client";

export async function getCurrentOrgId(): Promise<string | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data } = await supabase
    .from("organization_users")
    .select("organization_id")
    .eq("user_id", userRes.user.id)
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

export const PLATFORMS = [
  "Google Ads",
  "Meta Ads",
  "TikTok Ads",
  "LinkedIn Ads",
  "Ferramenta",
  "Outro",
] as const;
