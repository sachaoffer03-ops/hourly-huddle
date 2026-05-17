import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { completeShiftClockOut } from "./shift-clock.server";

const clockOutSchema = z.object({
  shiftId: z.string().uuid(),
  submissionId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  feedbackMsg: z.string().max(1000).nullable().optional(),
  reportMsg: z.string().max(2000).nullable().optional(),
  handoffMsg: z.string().max(2000).nullable().optional(),
});

export const completeShiftClockOutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clockOutSchema.parse(input))
  .handler(async ({ data, context }) => {
    return completeShiftClockOut({ ...data, actorId: context.userId });
  });