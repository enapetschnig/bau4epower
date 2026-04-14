import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  DEFAULT_PROMPT_1,
  DEFAULT_PROMPT_AUFGLIEDERUNG,
  DEFAULT_PROMPT_3,
  DEFAULT_PROMPT_4,
} from '../lib/prompts.js'

const DEFAULTS = {
  1: DEFAULT_PROMPT_1,
  2: DEFAULT_PROMPT_AUFGLIEDERUNG,
  3: DEFAULT_PROMPT_3,
  4: DEFAULT_PROMPT_4,
}

// Hochzählen bei jeder Prompt-Änderung → erzwingt Überschreibung in Supabase
const PROMPT_SEED = 'v2026-03-29f'

export function usePrompts() {
  const [prompts, setPrompts] = useState({ 1: null, 2: null, 3: null, 4: null })

  useEffect(() => {
    loadAndSeedPrompts()
  }, [])

  async function loadAndSeedPrompts() {
    try {
      const { data: rows } = await supabase
        .from('prompts')
        .select('*, prompt_versions(*)')
        .in('type', [1, 2, 3, 4])

      const loaded = {}
      for (const p of (rows || [])) {
        const active = (p.prompt_versions || []).find(v => v.version_number === p.active_version)
        if (!active) continue

        const currentDefault = DEFAULTS[p.type]
        const localSeedKey = `prompt_seed_type${p.type}`
        const storedSeed = localStorage.getItem(localSeedKey)
        const seedMismatch = storedSeed !== PROMPT_SEED
        console.log(`[usePrompts] Prompt type ${p.type}: storedSeed=${storedSeed}, PROMPT_SEED=${PROMPT_SEED}, seedMismatch=${seedMismatch}`)
        // Code-Default hat immer Vorrang – Supabase wird automatisch synchronisiert.
        // PROMPT_SEED erzwingt Überschreibung auch wenn Text zufällig gleich wäre.
        if (currentDefault && (active.text !== currentDefault || seedMismatch)) {
          console.log(`[usePrompts] Prompt type ${p.type}: auto-updating to current code default (seed: ${PROMPT_SEED})`)
          supabase.from('prompt_versions')
            .update({ text: currentDefault })
            .eq('id', active.id)
            .then(() => { localStorage.setItem(localSeedKey, PROMPT_SEED) })
          loaded[p.type] = currentDefault
        } else {
          loaded[p.type] = active.text
        }
      }

      // Seed any missing prompt types as version 1
      const existingTypes = (rows || []).map(p => p.type)
      for (const type of [1, 2, 3, 4]) {
        if (!existingTypes.includes(type)) {
          await seedPrompt(type)
          if (!loaded[type]) loaded[type] = DEFAULTS[type]
        }
      }

      setPrompts(prev => ({ ...prev, ...loaded }))
    } catch {
      // DB not reachable → fall back to defaults (null = use default in component)
    }
  }

  async function seedPrompt(type) {
    try {
      const { data: prompt, error } = await supabase
        .from('prompts')
        .insert({ type, active_version: 1 })
        .select()
        .single()
      if (error || !prompt) return
      await supabase.from('prompt_versions').insert({
        prompt_id: prompt.id,
        version_number: 1,
        text: DEFAULTS[type],
      })
    } catch {
      // Ignore seeding errors (e.g., DB constraint not yet updated to allow type 3 & 4)
    }
  }

  return {
    prompt1: prompts[1],
    prompt2: prompts[2],
    prompt3: prompts[3],
    prompt4: prompts[4],
  }
}
