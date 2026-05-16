import { useRef, useState } from "react";
import { Loader2, Upload, X, RefreshCw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { extractBrandColor } from "@/lib/extract-brand-color";

type Props = {
  value: string;
  orgId: string | null;
  onChange: (url: string, extractedColor?: string | null) => void;
  onRemove: () => void;
};

const MAX_BYTES = 2 * 1024 * 1024;

export function ClientLogoUpload({ value, orgId, onChange, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const handleFile = async (file: File) => {
    if (!orgId) {
      toast.error("Organização não encontrada");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Imagem muito grande (máx. 2 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-logos")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("client-logos").getPublicUrl(path);
      const color = await extractBrandColor(file);
      onChange(pub.publicUrl, color);
      toast.success(color ? "Logo enviada e cor extraída" : "Logo enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRecalculate = async () => {
    if (!value) return;
    setRecalculating(true);
    try {
      const color = await extractBrandColor(value);
      if (color) {
        onChange(value, color);
        toast.success("Cor recalculada");
      } else {
        toast.error("Não foi possível extrair a cor desta imagem");
      }
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-md border border-input bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {value ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {value && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={recalculating}
                onClick={handleRecalculate}
                title="Extrair cor novamente da imagem"
              >
                {recalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Recalcular cor
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                <X className="h-4 w-4" /> Remover
              </Button>
            </>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
