import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://nnibpmxtivlalrwjieyb.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaWJwbXh0aXZsYWxyd2ppZXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMDgxNzcsImV4cCI6MjEwMjc4NDE3N30.WAEkPLdkrIJsHBFp6iAdn0y7a2_B8goQpovmRTwnGA0'

export const supabase = createClient(url, key)

// Cliente para editar: envía la contraseña (ya transformada) en cada petición; la base de datos la valida
export const adminClient = (token) =>
  createClient(url, key, {
    global: { headers: { 'x-admin-pass': token } },
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-admin' }
  })

// La contraseña nunca viaja en claro: se envía su SHA-256 en hexadecimal
export async function hashPass(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('uruetafarmacia:' + pw))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
