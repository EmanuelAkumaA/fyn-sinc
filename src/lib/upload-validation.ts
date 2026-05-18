// Validação centralizada para uploads de arquivos.
// Bloqueia MIME inválido, extensões executáveis e arquivos acima do limite.

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf", "png", "jpg", "jpeg", "webp", "doc", "docx",
] as const;

export const ALLOWED_LOGO_MIMES = [
  "image/png", "image/jpeg", "image/webp", "image/svg+xml",
] as const;
export const ALLOWED_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "svg"] as const;

const BLOCKED_EXTENSIONS = new Set([
  "exe", "js", "mjs", "cjs", "html", "htm", "php", "sh", "bat", "cmd",
  "ps1", "vbs", "scr", "com", "msi", "jar", "py", "rb", "pl",
]);

export type ValidationResult = { ok: true } | { ok: false; reason: string };

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx + 1).toLowerCase();
}

function validate(
  file: File,
  allowedMimes: readonly string[],
  allowedExts: readonly string[],
  maxBytes = MAX_FILE_SIZE_BYTES,
): ValidationResult {
  if (file.size > maxBytes) {
    return { ok: false, reason: `O arquivo excede o tamanho máximo de ${Math.round(maxBytes / 1024 / 1024)}MB.` };
  }
  if (file.size === 0) {
    return { ok: false, reason: "Arquivo vazio." };
  }
  const ext = getExtension(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: "Tipo de arquivo não permitido." };
  }
  if (!allowedExts.includes(ext as (typeof allowedExts)[number])) {
    return { ok: false, reason: "Tipo de arquivo não permitido." };
  }
  if (file.type && !allowedMimes.includes(file.type as (typeof allowedMimes)[number])) {
    return { ok: false, reason: "Tipo de arquivo não permitido." };
  }
  return { ok: true };
}

export function validateDocumentFile(file: File): ValidationResult {
  return validate(file, ALLOWED_DOCUMENT_MIMES, ALLOWED_DOCUMENT_EXTENSIONS);
}

export function validateLogoFile(file: File): ValidationResult {
  // Logos costumam ser pequenos — limite de 2MB.
  return validate(file, ALLOWED_LOGO_MIMES, ALLOWED_LOGO_EXTENSIONS, 2 * 1024 * 1024);
}
