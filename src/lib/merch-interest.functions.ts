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
    const { error } = await supabaseAdmin.from("merch_interest").insert({
      email: data.email,
      product_slug: data.product_slug ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
