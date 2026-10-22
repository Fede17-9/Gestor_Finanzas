import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

export type AppSupabaseClient = SupabaseClient<Database>

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: false },
})
