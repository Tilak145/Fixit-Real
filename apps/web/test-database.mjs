// The TEST database (fixit-test). These are its public address and public (anon)
// key, which are meant to be in browsers; no secret key belongs here.
export const TEST_SUPABASE_URL = "https://mcmekpanodhzkdisvaiy.supabase.co";
export const TEST_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbWVrcGFub2RoemtkaXN2YWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU4MzM4MDEsImV4cCI6MjExMTQwOTgwMX0.MqQWpKxw8Qd6QfRoWXxKwt4IJSn_jAn-hepB4j4YTzE";

// Both spellings: the server code reads the ones without NEXT_PUBLIC_ first.
export const TEST_DATABASE_ENV = {
  SUPABASE_URL: TEST_SUPABASE_URL,
  SUPABASE_ANON_KEY: TEST_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: TEST_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: TEST_SUPABASE_ANON_KEY,
};
