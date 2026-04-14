import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useToast } from '../../contexts/ToastContext.jsx'

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const { data } = await supabase.from('users').select('*').order('created_at')
      setUsers(data || [])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function updateRole(userId, newRole) {
    try {
      await supabase.from('users').update({ role: newRole }).eq('id', userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      showToast('Rolle aktualisiert')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (loading) return <div className="card text-center py-8 text-gray-400">Lädt...</div>

  return (
    <div className="card space-y-4">
      <h3 className="font-bold text-secondary">Benutzer ({users.length})</h3>
      <div className="space-y-3">
        {users.map(user => (
          <div key={user.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-secondary truncate">{user.name || '–'}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <select
              className="input-field py-2 text-xs w-auto flex-shrink-0"
              value={user.role}
              onChange={e => updateRole(user.id, e.target.value)}
            >
              <option value="bauleiter">Bauleiter</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">Keine Benutzer gefunden</p>
        )}
      </div>
    </div>
  )
}
