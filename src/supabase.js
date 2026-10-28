import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://nnibpmxtivlalrwjieyb.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaWJwbXh0aXZsYWxyd2ppZXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMDgxNzcsImV4cCI6MjEwMjc4NDE3N30.WAEkPLdkrIJsHBFp6iAdn0y7a2_B8goQpovmRTwnGA0'

export const supabase = createClient(url, key)
