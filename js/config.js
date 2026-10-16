// Cloud sync settings — copy both values from Supabase → Project Settings → API.
// They are safe to publish: your data is protected by row-level security
// (see supabase/schema.sql), not by keeping these secret.
// Leave them empty to run Hisaab without accounts (data stays in this browser only).
window.HISAAB_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',  // the "anon" / "publishable" key — never the service_role key
};
