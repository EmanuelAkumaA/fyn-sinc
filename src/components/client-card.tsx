import { memo, useCallback, useMemo, type CSSProperties, type MouseEvent } from "react";
import { MoreHorizontal, Pencil, Mail, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientStatusBadge, FinancialStatusBadge } from "@/components/ui-helpers";
import { ClientLogo } from "@/components/client-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  status?: string | null;
  client_status?: string | null;
  financial_status?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
};

interface ClientCardProps {
  client: ClientLike;
  onEdit?: (client: ClientLike) => void;
  onOpen?: (client: ClientLike) => void;
  onDelete?: (client: ClientLike) => void;
  className?: string;
}

function ClientCardImpl({ client, onEdit, onOpen, onDelete, className }: ClientCardProps) {
  const style = useMemo<CSSProperties>(() => {
    const color = getBrandColor(client);
    return {
      "--client-color": color,
      "--client-glow": hexToRgba(color, 0.28),
      "--client-tint": hexToRgba(color, 0.06),
    } as CSSProperties;
  }, [client.brand_color, client.logo_url, client.name]);

  const stopNav = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const hasMenu = !!onEdit || !!onDelete;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(client)}
      style={style}
      className={cn("client-card group relative block w-full text-left", className)}
    >
      <div className="p-3 sm:p-4 md:p-5">
        {/* Linha 1: logo + nome + menu */}
        <div className="flex items-start gap-3">
          <ClientLogo client={client} size="md" className="client-card__logo" />

          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base truncate">{client.name}</div>
            {client.company && (
              <div className="text-xs text-muted-foreground truncate">{client.company}</div>
            )}
          </div>

          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={stopNav}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Ações do cliente"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={stopNav}>
                {onEdit && (
                  <DropdownMenuItem onSelect={() => onEdit(client)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    {onEdit && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onSelect={() => onDelete(client)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Linha 2: contatos + badges */}
        {(client.phone || client.email || client.client_status || client.status || client.financial_status) && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0">
              {client.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {client.phone}
                </span>
              )}
              {client.email && (
                <span className="inline-flex items-center gap-1 min-w-0 max-w-[18rem]">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <ClientStatusBadge value={client.client_status ?? client.status} />
              <FinancialStatusBadge value={client.financial_status} />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

export const ClientCard = memo(ClientCardImpl);
