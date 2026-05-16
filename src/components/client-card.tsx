import { memo, useCallback, useMemo, type CSSProperties, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui-helpers";
import { ClientLogo } from "@/components/client-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBrandColor, hexToRgba } from "@/lib/client-brand";

type ClientLike = {
  id: string;
  name: string;
  type?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: string;
  logo_url?: string | null;
  brand_color?: string | null;
};

interface ClientCardProps {
  client: ClientLike;
  onEdit?: (client: ClientLike) => void;
  className?: string;
}

export function ClientCard({ client, onEdit, className }: ClientCardProps) {
  const color = getBrandColor(client);
  const style = {
    "--client-color": color,
    "--client-glow": hexToRgba(color, 0.28),
    "--client-tint": hexToRgba(color, 0.06),
  } as CSSProperties;

  const stopNav = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to="/clientes/$id"
      params={{ id: client.id }}
      style={style}
      className={cn("client-card group relative block", className)}
    >
      <div className="flex items-center gap-4 p-4 md:p-5">
        <ClientLogo client={client} size="md" className="client-card__logo" />

        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-base truncate">{client.name}</div>
          {client.company && (
            <div className="text-xs text-muted-foreground truncate">{client.company}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {client.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {client.phone}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1 truncate max-w-[14rem]">
                <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{client.email}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={client.status} />
          {onEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={stopNav}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Ações do cliente"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={stopNav}>
                <DropdownMenuItem onSelect={() => onEdit(client)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </Link>
  );
}
