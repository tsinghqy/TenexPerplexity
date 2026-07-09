import { createClient } from '@/lib/supabase/client'

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  return await supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export async function signUp(email: string, password: string) {
  const supabase = createClient()
  return await supabase.auth.signUp({
    email,
    password,
  })
}

export async function signOut() {
  const supabase = createClient()
  return await supabase.auth.signOut()
}
