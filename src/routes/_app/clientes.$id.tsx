import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ClientDossier } from "@/components/client-dossier";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: ClientePage,
});

function ClientePage() {
  const { id } = Route.useParams();
  return (
    <>
      <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <ClientDossier clientId={id} />
    </>
  );
}
