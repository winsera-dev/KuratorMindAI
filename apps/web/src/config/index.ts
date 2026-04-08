import { z } from "zod";

/**
 * KuratorMind AI — Centralized Configuration
 * 
 * This schema validates all environment variables used in the web application.
 * If any required variables are missing, it will throw a clear error at runtime.
 */

const envSchema = z.object({
  // Core Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Backend URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_AGENT_API_URL: z.string().url().default("http://127.0.0.1:8000"),

  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// Parse and validate the environment variables
const envResult = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_AGENT_API_URL: process.env.NEXT_PUBLIC_AGENT_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!envResult.success) {
  console.error("❌ Invalid environment variables:", envResult.error.format());
  throw new Error("Invalid environment variables. Please check your .env file.");
}

export const config = {
  env: envResult.data.NODE_ENV,
  isDev: envResult.data.NODE_ENV === "development",
  isProd: envResult.data.NODE_ENV === "production",
  
  api: {
    baseUrl: envResult.data.NEXT_PUBLIC_BASE_URL || envResult.data.NEXT_PUBLIC_AGENT_API_URL,
    agentUrl: envResult.data.NEXT_PUBLIC_AGENT_API_URL,
  },

  supabase: {
    url: envResult.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: envResult.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
} as const;

export type Config = typeof config;
