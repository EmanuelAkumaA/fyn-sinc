import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui-helpers";

export const Route = createFileRoute("/_app/equipe-prestadores")({
  component: EquipePrestadoresPage,
  head: () => ({ meta: [{ title: "Equipe e Prestadores — Fyn Sinc" }] }),
});

function EquipePrestadoresPage() {
  return (
    <>
      <PageHeader title="Equipe e Prestadores" subtitle="Gestão de prestadores e obrigações" />
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Em construção"
        description="Cadastro de prestadores e payables será habilitado em breve."
      />
    </>
  );
}
