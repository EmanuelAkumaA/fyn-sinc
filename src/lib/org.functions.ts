import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyOrg = {
  id: string;
  name: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  member_role: string;
};

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ orgs: MyOrg[]; isSuperAdmin: boolean }> => {
    const { supabase, userId } = context;

    const [{ data: memberships, error }, { data: globalRole }] = await Promise.all([
      supabase
        .from("organization_users")
        .select(
          "member_role, status, organizations:organization_id(id, name, status, plan, trial_ends_at)",
        )
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("user_global_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (error) throw new Error(error.message);

    const orgs: MyOrg[] = (memberships ?? [])
      .filter((m) => m.organizations)
      .map((m) => {
        const o = m.organizations as unknown as {
          id: string;
          name: string;
          status: string;
          plan: string;
          trial_ends_at: string | null;
        };
        return {
          id: o.id,
          name: o.name,
          status: o.status,
          plan: o.plan,
          trial_ends_at: o.trial_ends_at,
          member_role: m.member_role,
        };
      });

    return { orgs, isSuperAdmin: globalRole?.role === "super_admin" };
  });
