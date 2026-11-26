import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

let cached = null // remember the answer so each component doesn't ask again

// Returns null while loading, then 'admin', 'manager' or 'none'.
export function useRole() {
  const [role, setRole] = useState(cached)

  useEffect(() => {
    if (cached) return
    supabase.rpc('app_role').then(({ data }) => {
      if (data) cached = data
      setRole(data ?? 'none')
    })
  }, [])

  return role
}
