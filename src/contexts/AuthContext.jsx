import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = useCallback(async (userId) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      else setProfile(null)

      if (roleRes.data) {
        setRole(roleRes.data.role)
      } else if (!roleRes.error) {
        setRole('mitarbeiter')
      } else {
        console.warn('[Auth] Role konnte nicht geladen werden:', roleRes.error)
        setRole(null)
      }
    } catch (err) {
      console.warn('[Auth] User-Daten Fehler:', err)
      setProfile(null)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUserData(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUserData(session.user.id)
      else { setProfile(null); setRole(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [loadUserData])

  async function refreshRole() {
    if (user) await loadUserData(user.id)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = role === 'administrator'
  const isActive = profile?.is_active === true
  const fullName = profile ? `${profile.vorname || ''} ${profile.nachname || ''}`.trim() : ''

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading, isAdmin, isActive, fullName,
      signIn, signOut, refreshRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
