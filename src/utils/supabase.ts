import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yuxkigenrmbpvkrnqink.supabase.co"; // Ganti dengan URL kamu
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1eGtpZ2Vucm1icHZrcm5xaW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NTg3NjgsImV4cCI6MjA2OTMzNDc2OH0.Ax2PiNGhbwhvmLKXwNknXZ_VilEJHEQltf-yFJh_n98"; // Ganti dengan Anon Key kamu

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
