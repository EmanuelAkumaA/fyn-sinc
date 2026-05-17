import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TrialSchema = z.object({
  responsibleName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  whatsapp: z.string().trim().min(8).max(40),
  companyName: z.string().trim().min(2).max(150),
  segment: z.string().trim().min(1).max(80),
  clientsEstimate: z.string().trim().min(1).max(40),
  password: z.string().min(8).max(128),
});

export const requestTrial = createServerFn({ method: "POST" })
  .inputValidator((input) => TrialSchema.parse(input))
  .handler(async ({ data }) => {
    // 1. Garantir usuário no Auth
    let userId: string | undefined;
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing.users.find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
    );
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            name: data.responsibleName,
            company_name: data.companyName,
          },
        });
      if (createErr || !created.user) {
        throw new Error(createErr?.message ?? "Falha ao criar usuário");
      }
      userId = created.user.id;
    }

    // 2. Criar organização em trial (15 dias)
    const now = new Date();
    const ends = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.companyName,
        status: "trial",
        plan: "trial",
        trial_start_at: now.toISOString(),
        trial_ends_at: ends.toISOString(),
      })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Falha ao criar organização");

    // 3. Vincular owner
    const { error: linkErr } = await supabaseAdmin
      .from("organization_users")
      .insert({
        organization_id: org.id,
        user_id: userId!,
        role: "admin",
        member_role: "owner",
        status: "active",
      });
    if (linkErr) throw new Error(linkErr.message);

    // 4. Registrar histórico
    await supabaseAdmin.from("trial_requests").insert({
      organization_id: org.id,
      responsible_name: data.responsibleName,
      email: data.email,
      whatsapp: data.whatsapp,
      company_name: data.companyName,
      segment: data.segment,
      clients_estimate: data.clientsEstimate,
    });

    return { ok: true as const, organizationId: org.id };
  });
