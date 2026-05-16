// @ts-expect-error - colorthief ships its own loose types
import ColorThief from "colorthief";

const rgbToHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/** Extrai a cor dominante de uma imagem (File ou URL). Retorna HEX ou null. */
export async function extractBrandColor(source: File | string): Promise<string | null> {
  try {
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    try {
      const img = await loadImage(url);
      const thief = new ColorThief();
      // Fallback if image is too tiny
      if (img.width < 2 || img.height < 2) return null;
      const [r, g, b] = thief.getColor(img) as [number, number, number];
      return rgbToHex(r, g, b);
    } finally {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
