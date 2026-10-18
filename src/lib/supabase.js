import { createClient } from '@supabase/supabase-js';
// A publishable key identifies this public client. Access is enforced by RLS.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tsgnpyxkuruphyadehyi.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_oDWI1r2FgNCGymL8bDVaDQ_rVecyQ-B';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
