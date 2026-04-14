/**
 * Diagnose-Script: Zeigt aktuelle Prompt-Texte in Supabase.
 * Ausführen: node --env-file=.env scripts/check-prompts.mjs
 *
 * HINWEIS: usePrompts.js aktualisiert Supabase automatisch beim App-Load
 * wenn sich der Code-Default geändert hat. Kein manuelles Update nötig.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Fehlende Umgebungsvariablen. Führe aus: node --env-file=.env scripts/check-prompts.mjs')
  process.exit(1)
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchPrompts() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prompts?select=type,active_version,prompt_versions(version_number,text)`,
    { headers }
  )
  return res.json()
}

async function updatePromptVersion(versionId, text) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_versions?id=eq.${versionId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ text }),
    }
  )
  return res.ok
}

const prompts = await fetchPrompts()

console.log('\n=== SUPABASE PROMPT STATUS ===')
for (const p of (prompts || [])) {
  const active = (p.prompt_versions || []).find(v => v.version_number === p.active_version)
  const len = active?.text?.length || 0
  console.log(`Typ ${p.type}: active_version=${p.active_version}, Text-Länge=${len} Zeichen (${(len/1024).toFixed(1)} kB)`)
  console.log(`  Anfang: ${active?.text?.substring(0, 80)}...`)
}

console.log('\nHINWEIS: Die App aktualisiert Supabase automatisch beim nächsten Seitenaufruf.')
console.log('Code-Default hat IMMER Vorrang (usePrompts.js auto-update aktiv).')
