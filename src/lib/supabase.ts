import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://aobcblixzaglfkuuwazb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvYmNibGl4emFnbGZrdXV3YXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDU4NTIsImV4cCI6MjA4OTkyMTg1Mn0.ACzOq7kVTCyia8ALtAQjGKQxydpyRAtbicjIJEIDSc4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
