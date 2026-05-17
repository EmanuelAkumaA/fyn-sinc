import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSuperAdmin } from "@/integrations/supabase/admin-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PlanSchema = z.enum(["trial", "starter", "professional", "enterprise"]);

export const adminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .handler(async () => {
    const nowIso = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [orgs, users, requests] = await Promise.all([
      supabaseAdmin.from("organizations").select("status, trial_ends_at"),
      supabaseAdmin.from("organization_users").select("user_id"),
      supabaseAdmin
        .from("trial_requests")
        .select("id, created_at")
        .gte("created_at", sevenDaysAgo),
    ]);

    const list = orgs.data ?? [];
    const trialActive = list.filter(
      (o) => o.status === "trial" && o.trial_ends_at && o.trial_ends_at >= nowIso,
    ).length;
    const trialExpired = list.filter(
      (o) => o.status === "trial" && o.trial_ends_at && o.trial_ends_at < nowIso,
    ).length;

    const uniqueUsers = new Set((users.data ?? []).map((u) => u.user_id));

    return {
      totalOrgs: list.length,
      trialActive,
      trialExpired,
      active: list.filter((o) => o.status === "active").length,
      suspended: list.filter((o) => o.status === "suspended").length,
      canceled: list.filter((o) => o.status === "canceled").length,
      totalUsers: uniqueUsers.size,
      newRequests7d: requests.data?.length ?? 0,
    };
  });

export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const orgIds = (data ?? []).map((o) => o.id);
    const owners = orgIds.length
      ? await supabaseAdmin
          .from("organization_users")
          .select("organization_id, user_id, member_role")
          .in("organization_id", orgIds)
          .eq("member_role", "owner")
      : { data: [] as Array<{ organization_id: string; user_id: string; member_role: string }> };

    const usersList = await supabaseAdmin.auth.admin.listUsers();
    const userById = new Map(usersList.data.users.map((u) => [u.id, u]));

    const ownerByOrg = new Map<string, { email: string | null; name: string | null }>();
    for (const ou of owners.data ?? []) {
      const u = userById.get(ou.user_id);
      if (u) ownerByOrg.set(ou.organization_id, { email: u.email ?? null, name: (u.user_metadata?.name as string) ?? null });
    }

    return (data ?? []).map((o) => ({
      ...o,
      owner_email: ownerByOrg.get(o.id)?.email ?? null,
      owner_name: ownerByOrg.get(o.id)?.name ?? null,
    }));
  });

export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: members } = await supabaseAdmin
      .from("organization_users")
      .select("user_id, member_role, status, created_at")
      .eq("organization_id", data.id);

    const usersList = await supabaseAdmin.auth.admin.listUsers();
    const userById = new Map(usersList.data.users.map((u) => [u.id, u]));

    const users = (members ?? []).map((m) => {
      const u = userById.get(m.user_id);
      return {
        user_id: m.user_id,
        email: u?.email ?? null,
        name: (u?.user_metadata?.name as string) ?? null,
        member_role: m.member_role,
        status: m.status,
        created_at: m.created_at,
      };
    });

    return { org, users };
  });

export const activateOrg = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) => z.object({ id: z.string().uuid(), plan: PlanSchema }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        status: "active",
        plan: data.plan,
        subscription_start_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const suspendOrg = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ status: "suspended" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelOrg = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ status: "canceled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendTrial = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("trial_ends_at")
      .eq("id", data.id)
      .single();
    const base = org?.trial_ends_at ? new Date(org.trial_ends_at) : new Date();
    const target = base < new Date() ? new Date() : base;
    target.setDate(target.getDate() + data.days);
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ status: "trial", trial_ends_at: target.toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) => z.object({ id: z.string().uuid(), plan: PlanSchema }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ plan: data.plan })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .handler(async () => {
    const users = await supabaseAdmin.auth.admin.listUsers();
    const memberships = await supabaseAdmin
      .from("organization_users")
      .select("user_id, member_role, organizations:organization_id(id, name)");
    const byUser = new Map<string, Array<{ id: string; name: string; role: string }>>();
    for (const m of memberships.data ?? []) {
      const o = m.organizations as unknown as { id: string; name: string } | null;
      if (!o) continue;
      const arr = byUser.get(m.user_id) ?? [];
      arr.push({ id: o.id, name: o.name, role: m.member_role });
      byUser.set(m.user_id, arr);
    }
    const globals = await supabaseAdmin.from("user_global_roles").select("user_id, role");
    const globalByUser = new Map((globals.data ?? []).map((g) => [g.user_id, g.role]));

    return users.data.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      name: (u.user_metadata?.name as string) ?? null,
      created_at: u.created_at,
      global_role: globalByUser.get(u.id) ?? null,
      orgs: byUser.get(u.id) ?? [],
    }));
  });

export const listTrials = createServerFn({ method: "GET" })
  .middleware([requireSuperAdmin])
  .inputValidator((i) =>
    z
      .object({
        filter: z.enum(["all", "active", "expiring", "expired", "converted"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const now = new Date();
    const in3d = new Date(Date.now() + 3 * 86400_000);
    return (orgs ?? []).filter((o) => {
      const ends = o.trial_ends_at ? new Date(o.trial_ends_at) : null;
      switch (data.filter) {
        case "active":
          return o.status === "trial" && ends && ends >= now;
        case "expiring":
          return o.status === "trial" && ends && ends >= now && ends <= in3d;
        case "expired":
          return o.status === "trial" && ends && ends < now;
        case "converted":
          return o.status === "active" && o.plan !== "trial";
        default:
          return o.trial_start_at != null || o.status === "trial";
      }
    });
  });
