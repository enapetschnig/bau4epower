import { useState, useEffect, useCallback } from 'react'
import { loadSettings, saveSetting } from '../lib/settings.js'

export function useSettings() {
  const [settings, setSettings] = useState({
    aufschlag_gesamt_prozent: 20,
    aufschlag_material_prozent: 30,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  const updateSetting = useCallback(async (key, value) => {
    await saveSetting(key, value)
    setSettings(prev => ({ ...prev, [key]: Number(value) }))
  }, [])

  return { settings, loading, updateSetting }
}
