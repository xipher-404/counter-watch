// Cloud-vision endpoint (Supabase edge function) that turns a photo of a screen
// into a list of heroes per team. The anon key is a public Supabase key (safe to
// ship); the function gates on it and keeps the Anthropic key server-side.
export const VISION_ENDPOINT = 'https://vaiwtkescnpigygtcomz.supabase.co/functions/v1/counter-watch-vision';
export const VISION_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhaXd0a2VzY25waWd5Z3Rjb216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNTk1MTYsImV4cCI6MjA5MDkzNTUxNn0.jcpPyYzMHw1KcC1SOeueCFaP6WjwMhuzTET24dGO5uI';
