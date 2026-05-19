import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DaySchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const ScheduleSchema = z.object({
  mon: DaySchema, tue: DaySchema, wed: DaySchema, thu: DaySchema,
  fri: DaySchema, sat: DaySchema, sun: DaySchema,
});

export type WorkingHours = {
  dnd_enabled: boolean;
  schedule: z.infer<typeof ScheduleSchema>;
  auto_reply: string;
  timezone: string;
};

const DEFAULTS: WorkingHours = {
  dnd_enabled: true,
  schedule: {
    mon: { enabled: true, start: "08:00", end: "18:00" },
    tue: { enabled: true, start: "08:00", end: "18:00" },
    wed: { enabled: true, start: "08:00", end: "18:00" },
    thu: { enabled: true, start: "08:00", end: "18:00" },
    fri: { enabled: true, start: "08:00", end: "18:00" },
    sat: { enabled: false, start: "09:00", end: "13:00" },
    sun: { enabled: false, start: "09:00", end: "13:00" },
  },
  auto_reply: "Thanks for your message. We will get back to you during working hours.",
  timezone: "Europe/London",
};

export const getWorkingHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkingHours> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("working_hours")
      .select("dnd_enabled, schedule, auto_reply, timezone")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as WorkingHours) ?? DEFAULTS;
  });

export const saveWorkingHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      dnd_enabled: z.boolean(),
      schedule: ScheduleSchema,
      auto_reply: z.string().min(1).max(500),
      timezone: z.string().min(1).max(60).default("Europe/London"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("working_hours")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
