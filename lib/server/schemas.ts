import { z } from "zod";

const httpUrl = z
  .string()
  .max(2048)
  .refine((u) => {
    try {
      const p = new URL(u);
      return p.protocol === "http:" || p.protocol === "https:";
    } catch {
      return false;
    }
  }, "must be an http(s) URL");

export const criteriaSchema = z.object({
  role: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120),
  seniority: z.enum(["any", "intern", "entry", "mid", "senior", "lead"]),
  employment: z.enum(["any", "internship", "full-time"]),
  keywords: z.array(z.string().trim().min(1).max(60)).max(15),
});

export const searchRequestSchema = z.object({
  criteria: criteriaSchema,
  limits: z.object({
    maxSources: z.number().int().min(1).max(50),
    maxDetailFetches: z.number().int().min(0).max(100),
  }),
});

export const extractRequestSchema = z.object({
  criteria: criteriaSchema,
  source: z.object({
    id: z.string().max(40),
    name: z.string().max(200),
    url: httpUrl,
    snippet: z.string().max(2000),
    query: z.string().max(500),
  }),
});

export const enrichRequestSchema = z.object({
  jobs: z
    .array(z.object({ id: z.string().max(40), title: z.string().max(200), apply_url: httpUrl }))
    .min(1)
    .max(10),
});

export const runRefSchema = z.object({ run_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) });
