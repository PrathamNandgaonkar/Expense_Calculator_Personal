// Cloud sync settings — copy both values from Supabase → Project Settings → API.
// They are safe to publish: your data is protected by row-level security
// (see supabase/schema.sql), not by keeping these secret.
// Leave them empty to run Hisaab without accounts (data stays in this browser only).
window.HISAAB_CONFIG = {
  supabaseUrl: 'https://jrbpelolozrzhmkexofk.supabase.co',      // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyYnBlbG9sb3pyemhta2V4b2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzU2MTMsImV4cCI6MjEwNzcxMTYxM30.DnliVHZWer5g3_3DKDVV4bf3USGdGCRGIeAac22oFj4',  // the "anon" / "publishable" key — never the service_role key
};
