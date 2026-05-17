import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fyn Sinc — Controle financeiro real para empresas de serviço" },
      {
        name: "description",
        content:
          "Sistema financeiro operacional para empresas de serviço. Organize receitas, repasses, aportes, comissões, taxas, cashback e recorrências por cliente — e veja o lucro real.",
      },
      { property: "og:title", content: "Fyn Sinc — Financeiro operacional por cliente" },
      {
        property: "og:description",
        content:
          "Controle receita própria, repasses, custos e recorrências em uma visão clara por cliente. Saiba quanto entra, quanto sai e quanto realmente sobra.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});
