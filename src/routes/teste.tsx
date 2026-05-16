import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/teste")({
  head: () => ({
    meta: [
      { title: "Teste" },
      { name: "description", content: "Página de teste." },
    ],
  }),
  component: TestePage,
});

function TestePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground">Teste</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta é uma página base simples.
        </p>
      </div>
    </main>
  );
}
