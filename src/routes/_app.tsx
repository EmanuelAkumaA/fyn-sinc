import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileBottomNav } from "@/components/app-sidebar";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
