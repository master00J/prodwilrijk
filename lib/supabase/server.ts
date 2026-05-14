import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (process.env.NODE_ENV === 'production' && (!supabaseUrl || !supabaseServiceKey)) {
  throw new Error('Supabase server environment variables are required in production.')
}

// Server-side client with service role key for admin operations
// Development/build fallbacks keep local tooling working without granting real access.
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-service-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)





