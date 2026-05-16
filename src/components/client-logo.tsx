import { useState } from "react";
import { cn } from "@/lib/utils";
import { type BrandClient, getBrandColor, getInitials, hexToRgba } from "@/lib/client-brand";

interface ClientLogoProps {
  client: BrandClient;
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-11 w-11 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
};

export function ClientLogo({ client, size = "md", glow = false, className }: ClientLogoProps) {
  const [failed, setFailed] = useState(false);
  const color = getBrandColor(client);
  const hasLogo = !!client.logo_url && !failed;

  const baseStyle: React.CSSProperties = {
    borderColor: hasLogo ? "rgba(247, 249, 250, 0.10)" : color,
    backgroundColor: hasLogo ? "rgba(0,0,0,0.25)" : hexToRgba(color, 0.18),
    filter: glow ? `drop-shadow(0 0 8px ${hexToRgba(color, 0.5)})` : undefined,
  };

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border flex items-center justify-center overflow-hidden transition",
        sizeMap[size],
        className,
      )}
      style={baseStyle}
    >
      {hasLogo ? (
        <img
          src={client.logo_url!}
          alt={client.name}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span className="font-display font-semibold text-white">{getInitials(client.name)}</span>
      )}
    </div>
  );
}
