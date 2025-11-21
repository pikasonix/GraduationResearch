import { createClient } from "@supabase/supabase-js";

/**
 * Initialize the Supabase client with environment variables
 */
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl) {
    throw new Error('Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in your environment.');
}

if (!supabaseAnonKey) {
    throw new Error('Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) in your environment.');
}

/**
 * Supabase client instance for use throughout the application
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);