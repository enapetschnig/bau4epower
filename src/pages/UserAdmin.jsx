import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Plus, X, SpinnerGap, Trash, MagnifyingGlass, ShieldCheck, User,
  CheckCircle, XCircle, FileXls, Phone, EnvelopeSimple,
  Lightning, SunHorizon, Wrench, ChatTeardropDots,
  ToggleLeft, ToggleRight, Warning,
} from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import {
  loadAllUsers, activateUser, deactivateUser,
  setUserRole, setUserGewerk, exportUserDataAsZip, deleteUserKeepData, loadUserStats,
} from '../lib/userAdmin.js'
import { GEWERKE, gewerkKurz } from '../lib/projectRecords.js'
import { supabase } from '../lib/supabase.js'
import PageHeader from '../components/Layout/PageHeader.jsx'

const GEWERK_ICONS = {
  elektro: { Icon: Lightning, color: 'text-amber-600', bg: 'bg-amber-100' },
  pv: { Icon: SunHorizon, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  installateur: { Icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-100' },
}

const REGISTRATION_LABELS = {
  manual: 'Manuell',
  sms_invite: 'SMS-Einladung',
  self_registration: 'Selbst registriert',
  admin_created: 'Admin angelegt',
}

export default function UserAdmin() {
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('alle')
  const [editing, setEditing] = useState(null)
  const [showInvite, setShowInvite] = useState(false)

  if (!isAdmin) return <Navigate to="/" replace />

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const [u, inv] = await Promise.all([
        loadAllUsers(),
        supabase.from('employee_invitations')
          .select('*')
          .order('created_at', { ascending: false }),
      ])
      setUsers(u || [])
      setInvitations(inv.data || [])
    } catch {
      showToast('Daten konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = users.filter(u => {
    if (filter === 'wartend' && u.is_active) return false
    if (filter === 'aktiv' && !u.is_active) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (u.email || '').toLowerCase().includes(s) ||
      (u.vorname || '').toLowerCase().includes(s) ||
      (u.nachname || '').toLowerCase().includes(s) ||
      (u.phone || '').toLowerCase().includes(s)
    )
  })

  const pendingInvitations = invitations.filter(i => i.status === 'pending' || i.status === 'sent')

  const counts = {
    alle: users.length,
    aktiv: users.filter(u => u.is_active).length,
    wartend: users.filter(u => !u.is_active).length,
  }

  return (
    <div className="max-w-4xl mx-auto pb-6">
      <PageHeader
        title="Benutzer-Verwaltung"
        subtitle="Mitarbeiter freischalten, Rollen vergeben"
        backTo="/admin"
        action={
          <button onClick={() => setShowInvite(true)} className="btn-primary px-3">
            <Plus size={14} weight="bold" />
            Einladen
          </button>
        }
      />

      <div className="px-4 pt-3">
        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <p className="text-[12px] font-bold text-blue-900 mb-2">
              {pendingInvitations.length} offene Einladung{pendingInvitations.length !== 1 ? 'en' : ''}
            </p>
            <div className="space-y-1">
              {pendingInvitations.slice(0, 3).map(i => (
                <div key={i.id} className="flex items-center justify-between text-[11px] text-blue-800">
                  <div className="flex items-center gap-2">
                    {i.phone && <Phone size={11} />}
                    <span>{i.vorname} {i.nachname}</span>
                    <span className="text-blue-600">· {i.phone || i.email}</span>
                    <span className="text-[9px] bg-white text-blue-700 px-1.5 py-px rounded uppercase">
                      {i.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-600">
                    {formatDate(i.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + Filter */}
        <div className="space-y-2 mb-3">
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              placeholder="Name, E-Mail oder Telefon..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { v: 'alle', l: 'Alle', c: counts.alle },
              { v: 'aktiv', l: 'Aktiv', c: counts.aktiv },
              { v: 'wartend', l: 'Wartend', c: counts.wartend },
            ].map(f => (
              <button key={f.v}
                onClick={() => setFilter(f.v)}
                className={`flex flex-col items-center justify-center py-2 rounded-lg border-2 transition-all
                  ${filter === f.v ? 'bg-primary-50 border-primary text-primary' : 'bg-white border-gray-200 text-gray-400'}`}
              >
                <span className="text-[11px] font-semibold">{f.l}</span>
                <span className="text-[9px] opacity-70">{f.c}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User-Liste */}
        {loading ? (
          <div className="flex justify-center py-12">
            <SpinnerGap size={28} weight="bold" className="text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <User size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-[13px] text-gray-400">Keine Benutzer gefunden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <UserCard
                key={u.id}
                user={u}
                isCurrentUser={u.id === user?.id}
                onEdit={() => setEditing(u)}
                onChanged={refresh}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <UserEditDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh() }}
        />
      )}

      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSent={() => { setShowInvite(false); refresh() }}
        />
      )}
    </div>
  )
}

function UserCard({ user, isCurrentUser, onEdit, onChanged, showToast }) {
  const [busy, setBusy] = useState(false)

  async function handleQuickActivate() {
    setBusy(true)
    try {
      await activateUser(user.id)
      showToast(`${user.vorname || user.email} freigeschaltet`)
      onChanged()
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setBusy(false)
    }
  }

  const cfg = user.default_gewerk ? GEWERK_ICONS[user.default_gewerk] : null
  const fullName = `${user.vorname || ''} ${user.nachname || ''}`.trim() || user.email || 'Unbekannt'

  return (
    <div className={`bg-white rounded-lg border p-3 transition-all
      ${user.is_active ? 'border-gray-100' : 'border-amber-200 bg-amber-50/30'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0
          ${user.role === 'administrator' ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-gradient-to-br from-primary to-orange-600'}`}>
          {user.vorname?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-[13px] font-semibold text-secondary truncate">
              {fullName}
              {isCurrentUser && <span className="text-[10px] text-gray-400 font-normal ml-1">(du)</span>}
            </p>
            {user.role === 'administrator' && (
              <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-px rounded font-bold flex items-center gap-0.5">
                <ShieldCheck size={9} weight="fill" />
                ADMIN
              </span>
            )}
            {!user.is_active && (
              <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-px rounded font-bold">
                {user.deactivated_at ? 'DEAKTIVIERT' : 'WARTET'}
              </span>
            )}
            {cfg && (
              <span className={`text-[9px] ${cfg.bg} ${cfg.color} px-1.5 py-px rounded font-medium flex items-center gap-0.5`}>
                <cfg.Icon size={9} weight="fill" />
                {gewerkKurz(user.default_gewerk)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
            {user.email && (
              <span className="flex items-center gap-1 truncate max-w-[180px]">
                <EnvelopeSimple size={10} />
                {user.email}
              </span>
            )}
            {user.phone && (
              <span className="flex items-center gap-1">
                <Phone size={10} />
                {user.phone}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {REGISTRATION_LABELS[user.registered_via] || user.registered_via} · {formatDate(user.created_at)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {!user.is_active && !user.deactivated_at && (
            <button
              onClick={handleQuickActivate}
              disabled={busy}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"
            >
              {busy ? <SpinnerGap size={10} weight="bold" className="animate-spin" /> : <CheckCircle size={10} weight="fill" />}
              Freischalten
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-secondary text-[10px] flex items-center gap-1 px-2 py-1"
          >
            Verwalten →
          </button>
        </div>
      </div>
    </div>
  )
}

function UserEditDialog({ user, onClose, onSaved }) {
  const { showToast } = useToast()
  const { user: currentUser } = useAuth()
  const [form, setForm] = useState({
    role: user.role || 'mitarbeiter',
    default_gewerk: user.default_gewerk || 'elektro',
    is_active: user.is_active,
    deactivation_reason: user.deactivation_reason || '',
  })
  const [stats, setStats] = useState(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isSelf = user.id === currentUser?.id

  useEffect(() => {
    loadUserStats(user.id).then(setStats).catch(() => {})
  }, [user.id])

  async function handleSave() {
    setSaving(true)
    try {
      // Rolle ggf. ändern
      if (form.role !== user.role) {
        await setUserRole(user.id, form.role)
      }
      // Gewerk ggf. ändern
      if (form.default_gewerk !== user.default_gewerk) {
        await setUserGewerk(user.id, form.default_gewerk)
      }
      // Aktivierung
      if (form.is_active && !user.is_active) {
        await activateUser(user.id)
      } else if (!form.is_active && user.is_active) {
        await deactivateUser(user.id, form.deactivation_reason)
      }
      showToast('Gespeichert')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleExportZip() {
    setExporting(true)
    try {
      await exportUserDataAsZip(user)
      showToast('Excel-Archiv heruntergeladen')
    } catch (err) {
      showToast(err.message || 'Export fehlgeschlagen', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      // Erst exportieren
      await exportUserDataAsZip(user)
      // Dann löschen (Daten bleiben, Login geht nicht mehr)
      await deleteUserKeepData(user.id, 'Account gelöscht – Daten archiviert')
      showToast('Account gelöscht – Stunden bleiben erhalten')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Fehler', 'error')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const fullName = `${user.vorname || ''} ${user.nachname || ''}`.trim() || user.email

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[95vh] overflow-auto">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Benutzer verwalten</p>
            <h2 className="text-base font-bold text-secondary">{fullName}</h2>
          </div>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* User-Info */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-[12px]">
            <Row label="E-Mail" value={user.email} />
            <Row label="Telefon" value={user.phone || '–'} />
            <Row label="Registriert via" value={REGISTRATION_LABELS[user.registered_via] || user.registered_via} />
            <Row label="Erstellt am" value={formatDateLong(user.created_at)} />
            {user.activated_at && <Row label="Aktiviert am" value={formatDateLong(user.activated_at)} />}
            {user.deactivated_at && <Row label="Deaktiviert am" value={formatDateLong(user.deactivated_at)} />}
            {user.deactivation_reason && (
              <Row label="Grund" value={user.deactivation_reason} />
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Stunden gesamt" value={stats.totalHours.toFixed(0)} unit="h" color="text-primary" />
              <StatBox label="Einträge" value={stats.timeEntries} color="text-blue-600" />
              <StatBox label="Projekte erstellt" value={stats.projectsCreated} color="text-emerald-600" />
            </div>
          )}

          {/* Aktivieren/Deaktivieren */}
          {!isSelf && (
            <div>
              <label className="label block mb-1.5">Status</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all
                  ${form.is_active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
              >
                <span className="flex items-center gap-2 text-[12px] font-semibold">
                  {form.is_active ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}
                  {form.is_active ? 'Aktiv – Zugriff erlaubt' : 'Deaktiviert – Kein Zugriff'}
                </span>
                {form.is_active
                  ? <ToggleRight size={22} weight="fill" className="text-emerald-500" />
                  : <ToggleLeft size={22} weight="fill" className="text-amber-500" />}
              </button>
              {!form.is_active && user.is_active && (
                <input
                  type="text"
                  value={form.deactivation_reason}
                  onChange={e => setForm({ ...form, deactivation_reason: e.target.value })}
                  placeholder="Grund der Deaktivierung (optional)"
                  className="input-field mt-2"
                />
              )}
            </div>
          )}

          {/* Rolle */}
          {!isSelf && (
            <div>
              <label className="label block mb-1.5">Rolle</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'mitarbeiter' })}
                  className={`py-2.5 rounded-lg text-[12px] font-semibold transition-all
                    ${form.role === 'mitarbeiter' ? 'bg-primary-50 border-2 border-primary text-primary' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
                >
                  <User size={12} weight="fill" className="inline mr-1" />
                  Mitarbeiter
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'administrator' })}
                  className={`py-2.5 rounded-lg text-[12px] font-semibold transition-all
                    ${form.role === 'administrator' ? 'bg-rose-50 border-2 border-rose-500 text-rose-600' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
                >
                  <ShieldCheck size={12} weight="fill" className="inline mr-1" />
                  Administrator
                </button>
              </div>
            </div>
          )}

          {/* Gewerk */}
          <div>
            <label className="label block mb-1.5">Standard-Gewerk</label>
            <div className="grid grid-cols-3 gap-2">
              {GEWERKE.map(g => {
                const cfg = GEWERK_ICONS[g.v]
                const active = form.default_gewerk === g.v
                return (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setForm({ ...form, default_gewerk: g.v })}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border-2 transition-all
                      ${active ? `${cfg.bg} border-current ${cfg.color}` : 'border-gray-200 bg-white text-gray-400'}`}
                  >
                    <cfg.Icon size={16} weight="fill" className={active ? cfg.color : 'text-gray-300'} />
                    <span className="text-[10px] font-semibold">{g.kurz}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? <SpinnerGap size={14} weight="bold" className="animate-spin" /> : 'Änderungen speichern'}
          </button>

          {/* Stunden-Export */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[12px] font-semibold text-secondary mb-2">Daten-Archiv</p>
            <p className="text-[11px] text-gray-500 mb-2">
              Lade alle Stunden, Regiearbeiten und Materialien als Excel-Datei herunter.
            </p>
            <button
              onClick={handleExportZip}
              disabled={exporting}
              className="btn-secondary w-full"
            >
              {exporting
                ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
                : <><FileXls size={14} weight="fill" /> Excel-Archiv herunterladen</>}
            </button>
          </div>

          {/* Löschen */}
          {!isSelf && (
            <div className="border-t border-rose-100 pt-4">
              <p className="text-[12px] font-semibold text-rose-700 mb-2 flex items-center gap-1">
                <Warning size={12} weight="fill" />
                Gefährliche Aktion
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-white border-2 border-rose-200 text-rose-600 py-2.5 rounded-lg text-[12px] font-semibold hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash size={14} weight="fill" />
                  Account löschen
                </button>
              ) : (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-lg p-3 space-y-2">
                  <p className="text-[12px] text-rose-900 font-semibold">Sicher löschen?</p>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    • Account-Login wird sofort entzogen<br/>
                    • Alle Stunden, Projekte und Daten bleiben erhalten<br/>
                    • Excel-Archiv wird vor Löschung automatisch heruntergeladen<br/>
                    • Aktion kann nicht direkt rückgängig gemacht werden
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 bg-white border border-rose-200 text-rose-600 py-2 rounded text-[11px] font-semibold"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1"
                    >
                      {saving ? <SpinnerGap size={11} className="animate-spin" /> : <><Trash size={11} weight="fill" /> Endgültig löschen</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InviteDialog({ onClose, onSent }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    vorname: '',
    nachname: '',
    phone: '',
    default_gewerk: 'elektro',
    role: 'mitarbeiter',
  })
  const [sending, setSending] = useState(false)
  const [link, setLink] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.vorname.trim() || !form.phone.trim()) {
      showToast('Bitte Vorname und Telefonnummer angeben', 'error')
      return
    }
    setSending(true)
    try {
      // 1. Code generieren
      const code = generateCode()

      // 2. Invitation in DB anlegen
      const { data: inv, error: insertErr } = await supabase
        .from('employee_invitations')
        .insert({
          code,
          phone: form.phone.trim(),
          vorname: form.vorname.trim(),
          nachname: form.nachname.trim(),
          default_gewerk: form.default_gewerk,
          role: form.role,
          status: 'pending',
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // 3. SMS via Vercel-API senden
      const { data: { session } } = await supabase.auth.getSession()
      const userToken = session?.access_token || ''

      const res = await fetch('/api/send-sms-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-token': userToken,
        },
        body: JSON.stringify({
          invitationId: inv.id,
          phone: form.phone.trim(),
          vorname: form.vorname.trim(),
          code,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Wenn SMS fehlschlägt: Link trotzdem zeigen
        const fallbackUrl = `${window.location.origin}/register?code=${code}`
        setLink(fallbackUrl)
        showToast(`SMS-Versand fehlgeschlagen, Link manuell teilen: ${data.error || 'Twilio nicht konfiguriert'}`, 'error')
        return
      }

      setLink(data.registerUrl)
      showToast(`SMS an ${data.to} gesendet`)
    } catch (err) {
      showToast(err.message || 'Fehler beim Einladen', 'error')
    } finally {
      setSending(false)
    }
  }

  if (link) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl mx-auto mb-3 flex items-center justify-center">
              <CheckCircle size={28} weight="fill" className="text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-secondary mb-1">Einladung erstellt</h2>
            <p className="text-[12px] text-gray-500 mb-4">
              {form.vorname} kann sich nun über den Link registrieren.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-left">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Registrierungs-Link</p>
              <p className="text-[11px] text-secondary break-all font-mono">{link}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(link); showToast('Link kopiert') }}
                className="mt-2 text-[11px] text-primary font-semibold"
              >
                In Zwischenablage kopieren
              </button>
            </div>
            <button onClick={onSent} className="btn-primary w-full mt-4">
              Schließen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">Mitarbeiter per SMS einladen</h2>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        <p className="text-[11px] text-gray-500 mb-4">
          Der eingeladene Mitarbeiter bekommt eine SMS mit einem Link, um sich zu registrieren.
          Sein Account ist sofort aktiv (kein zusätzliches Freischalten nötig).
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label block mb-0.5">Vorname *</label>
              <input required value={form.vorname}
                onChange={e => setForm({ ...form, vorname: e.target.value })}
                className="input-field" placeholder="Max" />
            </div>
            <div>
              <label className="label block mb-0.5">Nachname</label>
              <input value={form.nachname}
                onChange={e => setForm({ ...form, nachname: e.target.value })}
                className="input-field" placeholder="Mustermann" />
            </div>
          </div>

          <div>
            <label className="label block mb-0.5">Telefonnummer *</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input required type="tel" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="input-field pl-9" placeholder="+43 664 1234567" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Format: +43 oder 0664... – wird automatisch normalisiert</p>
          </div>

          <div>
            <label className="label block mb-1">Standard-Gewerk</label>
            <div className="grid grid-cols-3 gap-2">
              {GEWERKE.map(g => {
                const cfg = GEWERK_ICONS[g.v]
                const active = form.default_gewerk === g.v
                return (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setForm({ ...form, default_gewerk: g.v })}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all
                      ${active ? `${cfg.bg} border-current ${cfg.color}` : 'border-gray-200 bg-white text-gray-400'}`}
                  >
                    <cfg.Icon size={14} weight="fill" className={active ? cfg.color : 'text-gray-300'} />
                    <span className="text-[10px] font-semibold">{g.kurz}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label block mb-1">Rolle</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'mitarbeiter' })}
                className={`py-2.5 rounded-lg text-[12px] font-semibold transition-all
                  ${form.role === 'mitarbeiter' ? 'bg-primary-50 border-2 border-primary text-primary' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
              >
                Mitarbeiter
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'administrator' })}
                className={`py-2.5 rounded-lg text-[12px] font-semibold transition-all
                  ${form.role === 'administrator' ? 'bg-rose-50 border-2 border-rose-500 text-rose-600' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
              >
                Administrator
              </button>
            </div>
          </div>

          <button type="submit" disabled={sending} className="btn-primary w-full mt-3">
            {sending
              ? <SpinnerGap size={14} weight="bold" className="animate-spin" />
              : <><ChatTeardropDots size={14} weight="fill" /> SMS-Einladung senden</>}
          </button>
        </form>
      </div>
    </div>
  )
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne I,O,0,1
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 w-28 flex-shrink-0">{label}:</span>
      <span className="text-secondary flex-1 break-words">{value || '–'}</span>
    </div>
  )
}

function StatBox({ label, value, unit, color }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-2 text-center">
      <p className="text-[9px] text-gray-400 uppercase tracking-wider truncate">{label}</p>
      <p className={`text-base font-bold ${color} mt-0.5`}>
        {value}{unit && <span className="text-[10px] text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateLong(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
