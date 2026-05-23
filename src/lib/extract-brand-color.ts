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

/**
 * Extrai a cor dominante (mais saturada/representativa) de uma imagem,
 * ignorando pixels transparentes e quase brancos/pretos.
 * Implementação própria via canvas — sem dependências externas.
 */
export async function extractBrandColor(source: File | string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  let url: string;
  if (typeof source === "string") {
    // Cache-bust para evitar reaproveitar uma resposta cacheada SEM cabeçalhos CORS
    url = source + (source.includes("?") ? "&" : "?") + "cbc=" + Date.now();
  } else {
    url = URL.createObjectURL(source);
  }
  try {
    const img = await loadImage(url);
    // SVGs e algumas imagens podem não ter dimensão intrínseca
    const iw = img.naturalWidth || img.width || 256;
    const ih = img.naturalHeight || img.height || 256;

    const MAX = 80;
    const ratio = Math.min(MAX / iw, MAX / ih, 1);
    const w = Math.max(1, Math.round(iw * ratio));
    const h = Math.max(1, Math.round(ih * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch {
      return null; // CORS taint
    }

    // Quantiza em buckets de 32 e pondera por saturação
    const buckets = new Map<string, { r: number; g: number; b: number; weight: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Ignora quase preto / quase branco / cinza
      if (max < 25 || min > 235) continue;
      const sat = max === 0 ? 0 : (max - min) / max;
      const weight = 1 + sat * 4; // dá mais peso para cores saturadas

      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const cur = buckets.get(key);
      if (cur) {
        cur.r += r * weight;
        cur.g += g * weight;
        cur.b += b * weight;
        cur.weight += weight;
      } else {
        buckets.set(key, { r: r * weight, g: g * weight, b: b * weight, weight });
      }
    }

    if (buckets.size === 0) return null;

    let best: { r: number; g: number; b: number; weight: number } | null = null;
    for (const v of buckets.values()) {
      if (!best || v.weight > best.weight) best = v;
    }
    if (!best) return null;

    return rgbToHex(best.r / best.weight, best.g / best.weight, best.b / best.weight);
  } catch {
    return null;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
