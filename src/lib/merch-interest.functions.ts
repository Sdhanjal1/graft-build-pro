import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  email: z.string().email().max(255),
  product_slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
});

export const registerMerchInterest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort attach of logged-in user, if any.
    let user_id: string | null = null;
    try {
      const { getHeader } = await import("@tanstack/react-start/server");
      const auth = getHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
        user_id = u.user?.id ?? null;
      }
    } catch {
      // header not available in this context — ignore
    }

    const { error } = await supabaseAdmin.from("merch_interest").insert({
      email: data.email,
      product_slug: data.product_slug ?? null,
      user_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
