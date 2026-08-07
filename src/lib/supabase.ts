import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = "https://gfjvyjyfrdccrfdlbcpq.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmanZ5anlmcmRjY3JmZGxiY3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4ODc2MDYsImV4cCI6MjEwMTQ2MzYwNn0.mhxgISsyggeEfXv6kob8und4mMgjQAWfyZDwY4kjn0E";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "implicit",
    autoRefreshToken: true,
  },
});