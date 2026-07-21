const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_KEY. Copy .env.example to .env and fill in the values from your Supabase dashboard (Project Settings -> API).'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { createSupabaseClient };
