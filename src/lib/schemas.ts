// Schemas Zod centrais para validação de formulários sensíveis.
import { z } from "zod";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(200, "Nome muito longo"),
  type: z.enum(["PF", "PJ"]),
  document: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido").max(255)]),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000, "Observações muito longas").optional().or(z.literal("")),
  client_status: z.enum(["ativo", "inativo"]),
  financial_status: z.enum(["em_dia", "inadimplente"]),
  logo_url: z.union([z.literal(""), z.string().url("URL inválida").max(2000)]),
  brand_color: z.union([z.literal(""), z.string().regex(HEX, "Cor inválida (use HEX, ex.: #14B8A6)")]),
});

export const documentUploadSchema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(200),
  document_type: z.string().min(1).max(50),
  description: z.string().max(1000).optional().or(z.literal("")),
  document_date: z.string().max(10).optional().or(z.literal("")),
});

export const transactionAmountSchema = z
  .number({ invalid_type_error: "Valor inválido" })
  .nonnegative("Valor não pode ser negativo")
  .finite();
