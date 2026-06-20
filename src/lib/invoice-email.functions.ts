import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Re-send the branded paid-invoice email for a quote owned by the
 * authenticated user. Records the outcome on the quotes row so the
 * invoice screen can show whether it actually went out.
 */
export const sendInvoiceEmailForQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      quoteId: z.string().min(1).max(128),
      mode: z.enum(["receipt", "invoice", "balance"]).optional(),
      amountCents: z.number().int().nonnegative().optional(),
      depositPaidCents: z.number().int().nonnegative().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify ownership before doing privileged work.
    const { data: owned, error } = await supabase
      .from("quotes")
      .select("id")
      .eq("id", data.quoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!owned) throw new Error("Quote not found");

    const { sendAndRecordInvoiceEmail } = await import("@/lib/invoice-email.server");
    return await sendAndRecordInvoiceEmail({
      userId,
      quoteId: data.quoteId,
      paymentMethod: "manual",
      mode: data.mode,
      amountCents: data.amountCents,
      depositPaidCents: data.depositPaidCents,
    });
  });

/** Read the current invoice-email status for a quote. */
export const getInvoiceEmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ quoteId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("quotes")
      .select("invoice_email_status, invoice_email_sent_at, invoice_email_error, invoice_email_to")
      .eq("id", data.quoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? {
      invoice_email_status: null,
      invoice_email_sent_at: null,
      invoice_email_error: null,
      invoice_email_to: null,
    };
  });
