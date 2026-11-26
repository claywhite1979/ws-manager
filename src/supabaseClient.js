import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only the live staff site sends a Clerk login token.
// - localhost uses the development Clerk instance, which Supabase does not trust,
//   so sending its token would cause rejections.
// - the team host never loads Clerk, so it stays anonymous.
const TOKEN_HOSTS = ['manage.whitetailspur.com', 'localhost']

async function getClerkToken() {
  if (!TOKEN_HOSTS.includes(window.location.hostname)) return null

  // Wait briefly for Clerk to finish loading, so early page queries carry the token
  for (let i = 0; i < 30; i++) {
    if (window.Clerk?.loaded) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return (await window.Clerk?.session?.getToken()) ?? null
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: getClerkToken,
})