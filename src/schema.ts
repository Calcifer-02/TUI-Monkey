import {z} from 'zod';

export const configSchema = z.object({
  mode: z.enum(['words', 'time', 'custom']).default('words'),
  language: z.string().regex(/^[a-z0-9-]+$/).default('english200'),
  words: z.number().int().min(1).max(1000).default(25),
  duration: z.number().int().min(1).max(600).default(30),
  suddenDeath: z.boolean().default(false),
  noBackspace: z.boolean().default(false),
  noBacktrack: z.boolean().default(false),
  text: z.string().max(20000).optional(),
  wordList: z.array(z.string().min(1).max(200)).max(20000).optional(),
});
export type Config = z.infer<typeof configSchema>;
const metric = z.number().finite().nonnegative();
export const stateSchema = z.object({
  config: configSchema, text: z.string(), typed: z.string(),
  status: z.enum(['ready', 'running', 'complete', 'failed', 'aborted']),
  elapsed: metric, remaining: metric, wpm: metric, rawWpm: metric,
  accuracy: metric.max(100), progress: metric.max(1),
  errors: metric, streak: metric, bestStreak: metric, correct: metric, attempts: metric,
  missedWords: z.array(z.string()),
  weakKeys: z.array(z.object({key: z.string(), misses: metric})),
  samples: z.array(metric),
});
export type State = z.infer<typeof stateSchema>;
export const responseSchema = z.object({
  id: z.number().int(), state: stateSchema.optional(),
  languages: z.array(z.string()).optional(), error: z.string().optional(),
});
export const recordSchema = z.object({
  id: z.string().uuid(), date: z.string(), mode: configSchema.shape.mode,
  language: z.string(), words: metric, duration: metric, suddenDeath: z.boolean(),
  noBackspace: z.boolean(), noBacktrack: z.boolean(),
  wpm: metric, accuracy: metric.max(100), elapsed: metric,
  bestStreak: metric, failed: z.boolean(),
  status: z.enum(['complete', 'failed', 'aborted']).optional(),
  correct: metric.optional(), attempts: metric.optional(), progress: metric.optional(),
});
export type Record = z.infer<typeof recordSchema>;
export const historySchema = z.object({version: z.literal(1), records: z.array(recordSchema).max(1000)});
