// Supabase project settings (Project Settings → API in the Supabase dashboard).
// Both values are meant to be public; the database rules in supabase/setup.sql
// make sure each account can only read and change its own progress.
// Leave them empty to run without accounts (progress stays in the browser).
window.EWJ_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
