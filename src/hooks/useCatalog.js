import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { parseExcel } from '../lib/excelParser.js'

const isDev = import.meta.env.DEV

export function useCatalog() {
  const [versions, setVersions] = useState([])
  const [activeVersion, setActiveVersionState] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [stundensaetze, setStundensaetze] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVersions()
  }, [])

  async function loadVersions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('id, name, uploaded_at, uploaded_by, is_active, stundensaetze_json')
        .order('uploaded_at', { ascending: false })

      if (error) throw error

      const list = data || []
      setVersions(list)

      const active = list.find(v => v.is_active) || list[0]
      if (active) {
        await loadActiveVersion(active.id)
      } else {
        setCatalog([])
        setStundensaetze({})
      }
    } catch {
      setCatalog([])
      setStundensaetze({})
    } finally {
      setLoading(false)
    }
  }

  async function loadActiveVersion(id) {
    const { data } = await supabase
      .from('catalog')
      .select('*')
      .eq('id', id)
      .single()

    if (data) {
      setActiveVersionState(data)
      // Fix floating-point artefacts in catalog prices (e.g. 59.9989 → 60.00)
      const positionen = (Array.isArray(data.data_json) ? data.data_json : []).map(p => ({
        ...p,
        preis: Math.round((Number(p.preis) || 0) * 100) / 100,
        zeit_min: Math.round(Number(p.zeit_min) || 0),
      }))
      if (positionen.length > 0) {
        isDev && console.log('KATALOG KEYS:', Object.keys(positionen[0]))
        isDev && console.log('KATALOG BEISPIEL 01-001:', positionen.find(p => p.nr === '01-001'))
        isDev && console.log('KATALOG BEISPIEL 01-002:', positionen.find(p => p.nr === '01-002'))
      }
      setCatalog(positionen)
      // Fix floating-point artefacts from Excel parsing (e.g. 59.9989 → 60)
      const rawRates = data.stundensaetze_json || {}
      const fixedRates = {}
      for (const [k, v] of Object.entries(rawRates)) {
        fixedRates[k] = Math.round(Number(v))
      }
      setStundensaetze(fixedRates)
    }
  }

  async function activateVersion(id) {
    // Deactivate all, then activate selected
    await supabase.from('catalog').update({ is_active: false }).neq('id', 'none')
    await supabase.from('catalog').update({ is_active: true }).eq('id', id)
    await loadVersions()
  }

  async function uploadExcel(file, name) {
    const buffer = await file.arrayBuffer()
    const { positionen, stundensaetze: rates } = parseExcel(new Uint8Array(buffer))

    const versionName = name || `Preisliste ${new Date().toLocaleDateString('de-AT')}`

    // Deactivate all existing versions
    await supabase.from('catalog').update({ is_active: false }).neq('id', 'none')

    const { error } = await supabase.from('catalog').insert({
      name: versionName,
      data_json: positionen,
      stundensaetze_json: rates,
      is_active: true,
    })

    if (error) throw error
    await loadVersions()

    return { count: positionen.length, stundensaetze: rates }
  }

  async function renameVersion(id, newName) {
    await supabase.from('catalog').update({ name: newName }).eq('id', id)
    setVersions(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v))
  }

  async function deleteVersion(id) {
    await supabase.from('catalog').delete().eq('id', id)
    await loadVersions()
  }

  return {
    catalog,
    stundensaetze,
    versions,
    activeVersion,
    loading,
    uploadExcel,
    activateVersion,
    renameVersion,
    deleteVersion,
  }
}
