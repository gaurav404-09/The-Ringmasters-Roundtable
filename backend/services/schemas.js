import { z } from 'zod';

// Schema for the chatAgent's trigger payload
export const triggerPayloadSchema = z.object({
  TRIGGER_PLAN: z.literal(true),
  startCity: z.string().min(1),
  endCity: z.string().min(1),
  numDays: z.number().int().positive(),
  travelers: z.number().int().positive(),
  interests: z.array(z.string())
});

// Schema for the Route Planner's proposed stops
export const routePlanSchema = z.object({
  travel_plan: z.array(
    z.object({
      city: z.string().min(1),
      days: z.number().int().min(0), // 0 is allowed for a start city if just passing through
      type: z.enum(['base', 'stop', 'day_trip']).default('base')
    })
  ).min(1)
});

// Schema for the Critic's structured output
export const criticOutputSchema = z.object({
  approved: z.boolean(),
  reason: z.enum(['distance', 'logistics', 'duration_mismatch', 'other']).nullable().optional(),
  details: z.string().nullable().optional(),
  suggestedFix: z.string().nullable().optional()
});
