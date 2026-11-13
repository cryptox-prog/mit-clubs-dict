import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdmin(config) {
  // Dedicated server client. Never attach a user's JWT or call auth signIn here.
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' },
  });
}
