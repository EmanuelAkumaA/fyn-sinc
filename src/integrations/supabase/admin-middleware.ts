import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

export const requireSuperAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_global_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Falha ao verificar permissão global");
    if (!data || data.role !== "super_admin") {
      throw new Error("Forbidden: super_admin requerido");
    }
    return next({ context: { ...context, isSuperAdmin: true as const } });
  });
