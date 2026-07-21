require('dotenv').config({ quiet: true });

const { createSupabaseClient } = require('./supabase');
const { createApp } = require('./app');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);

async function checkSupabaseConnection() {
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: process.env.SUPABASE_KEY },
  });
  if (!res.ok) {
    throw new Error(`Supabase auth health check returned HTTP ${res.status}`);
  }
}

const supabase = createSupabaseClient();
const app = createApp(supabase);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await checkSupabaseConnection();
    console.log('Connected to Supabase');
  } catch (err) {
    console.warn(`Warning: could not reach Supabase (${err.message}). Check SUPABASE_URL and SUPABASE_KEY in .env.`);
  }
});
