import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { loadTemplates, saveTemplate, renameTemplate, updateTemplate, deleteTemplate } from '../lib/templates.js'

export function useTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await loadTemplates()
      setTemplates(data)
    } catch {
      // DB not reachable
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { reload() }, [reload])

  const save = useCallback(async ({ name, inputText, type }) => {
    if (!user) return
    const item = await saveTemplate({ userId: user.id, name, inputText, type })
    setTemplates(prev => [item, ...prev])
    return item
  }, [user])

  const rename = useCallback(async (id, name) => {
    await renameTemplate(id, name)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t))
  }, [])

  const update = useCallback(async (id, { name, inputText }) => {
    await updateTemplate(id, { name, inputText })
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name, template_data: { inputText } } : t))
  }, [])

  const remove = useCallback(async (id) => {
    await deleteTemplate(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  return { templates, loading, save, rename, update, remove, reload }
}
