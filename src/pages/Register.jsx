import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { SpinnerGap, EnvelopeSimple, Lock, Phone, User, CheckCircle, Warning, Lightning, SunHorizon, Wrench } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import Logo from '../components/Logo.jsx'
import { GEWERKE } from '../lib/projectRecords.js'

const GEWERK_ICONS = {
  elektro: { Icon: Lightning, color: 'text-amber-600', bg: 'bg-amber-100' },
  pv: { Icon: SunHorizon, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  installateur: { Icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-100' },
}

export default function Register() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = searchParams.get('code')

  const [invitation, setInvitation] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(!!code)

  const [form, setForm] = useState({
    vorname: '',
    nachname: '',
    email: '',
    phone: '',
    gewerk: 'elektro',
    password: '',
    passwordConfirm: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!code) return
    loadInvitation(code)
  }, [code])

  async function loadInvitation(c) {
    setLoadingInvite(true)
    try {
      const { data, error } = await supabase
        .from('employee_invitations')
        .select('*')
        .eq('code', c)
        .in('status', ['pending', 'sent'])
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (error || !data) {
        setError('Einladungscode ungültig oder abgelaufen')
        setInvitation(null)
      } else {
        setInvitation(data)
        setForm(f => ({
          ...f,
          vorname: data.vorname || '',
          nachname: data.nachname || '',
          phone: data.phone || '',
          email: data.email || '',
          gewerk: data.default_gewerk || 'elektro',
        }))
      }
    } catch (err) {
      setError('Fehler beim Laden der Einladung')
    } finally {
      setLoadingInvite(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.vorname.trim() || !form.nachname.trim()) {
      setError('Bitte Vor- und Nachnamen angeben')
      return
    }
    if (!form.email.trim()) {
      setError('Bitte E-Mail-Adresse angeben')
      return
    }
    if (form.password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen haben')
      return
    }
    if (form.password !== form.passwordConfirm) {
      setError('Passwörter stimmen nicht überein')
      return
    }

    setSubmitting(true)
    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            vorname: form.vorname.trim(),
            nachname: form.nachname.trim(),
            phone: form.phone.trim(),
            default_gewerk: form.gewerk,
            invite_code: code || null,
          },
        },
      })

      if (signupError) {
        if (signupError.message.includes('already')) {
          setError('Diese E-Mail-Adresse ist bereits registriert')
        } else {
          setError(signupError.message)
        }
        return
      }

      setSuccess(true)
      // Nach 3 Sek zum Login
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message || 'Registrierung fehlgeschlagen')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <SpinnerGap size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-emerald-50 to-white">
        <div className="max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-3xl mb-4">
            <CheckCircle size={40} weight="fill" className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-secondary mb-2">Registrierung erfolgreich!</h1>
          <p className="text-[13px] text-gray-500">
            {invitation
              ? 'Dein Account ist bereits aktiv. Du wirst gleich zur Anmeldung weitergeleitet.'
              : 'Dein Account wurde erstellt. Ein Administrator wird ihn jetzt freischalten.'}
          </p>
          <Link to="/login" className="btn-primary inline-flex mt-6">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    )
  }

  const gewerkObj = GEWERKE.find(g => g.v === form.gewerk)
  const gewerkCfg = GEWERK_ICONS[form.gewerk]

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Logo size="lg" />
          <p className="text-[11px] text-gray-400 tracking-[0.2em] uppercase">Registrierung</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: '0 4px 16px rgba(246,135,20,0.08)' }}>

          {invitation ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <CheckCircle size={16} weight="fill" className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-emerald-900">Einladung gefunden!</p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Du wurdest zur ET KÖNIG App eingeladen. Setze nur noch dein Passwort.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Warning size={16} weight="fill" className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-amber-900">Selbst-Registrierung</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Dein Account muss nach der Registrierung von einem Administrator
                  freigeschaltet werden.
                </p>
              </div>
            </div>
          )}

          <h1 className="text-base font-bold text-secondary mb-1">Account erstellen</h1>
          <p className="text-[12px] text-gray-400 mb-4">Bitte fülle alle Felder aus</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label block mb-1">Vorname *</label>
                <input
                  required
                  value={form.vorname}
                  onChange={e => setForm({ ...form, vorname: e.target.value })}
                  className="input-field"
                  placeholder="z.B. Max"
                />
              </div>
              <div>
                <label className="label block mb-1">Nachname *</label>
                <input
                  required
                  value={form.nachname}
                  onChange={e => setForm({ ...form, nachname: e.target.value })}
                  className="input-field"
                  placeholder="z.B. Mustermann"
                />
              </div>
            </div>

            <div>
              <label className="label block mb-1">E-Mail *</label>
              <div className="relative">
                <EnvelopeSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-field pl-9"
                  placeholder="name@email.at"
                  disabled={!!invitation?.email}
                />
              </div>
            </div>

            <div>
              <label className="label block mb-1">Telefon</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input-field pl-9"
                  placeholder="+43 664 1234567"
                />
              </div>
            </div>

            {!invitation && (
              <div>
                <label className="label block mb-1">Gewerk</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {GEWERKE.map(g => {
                    const cfg = GEWERK_ICONS[g.v]
                    const active = form.gewerk === g.v
                    return (
                      <button
                        key={g.v}
                        type="button"
                        onClick={() => setForm({ ...form, gewerk: g.v })}
                        className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg border-2 transition-all
                          ${active ? `${cfg.bg} border-current ${cfg.color}` : 'border-gray-200 bg-white text-gray-400'}`}
                      >
                        <cfg.Icon size={14} weight="fill" className={active ? cfg.color : 'text-gray-300'} />
                        <span className="text-[10px] font-semibold">{g.kurz}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {invitation && gewerkCfg && (
              <div className="bg-gray-50 rounded-lg p-2.5 flex items-center gap-2">
                <div className={`w-8 h-8 ${gewerkCfg.bg} rounded-md flex items-center justify-center`}>
                  <gewerkCfg.Icon size={14} weight="fill" className={gewerkCfg.color} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Zugewiesenes Gewerk</p>
                  <p className="text-[12px] font-semibold text-secondary">{gewerkObj?.l}</p>
                </div>
              </div>
            )}

            <div>
              <label className="label block mb-1">Passwort * <span className="text-gray-300 normal-case font-normal">(min. 8 Zeichen)</span></label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-field pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="label block mb-1">Passwort bestätigen *</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="password"
                  required
                  value={form.passwordConfirm}
                  onChange={e => setForm({ ...form, passwordConfirm: e.target.value })}
                  className="input-field pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-4"
            >
              {submitting
                ? <SpinnerGap size={16} weight="bold" className="animate-spin" />
                : invitation ? 'Account aktivieren' : 'Account erstellen'}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 mt-4">
            Schon einen Account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Anmelden
            </Link>
          </p>
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-6 tracking-wide">
          ET KÖNIG GmbH · Frojach
        </p>
      </div>
    </div>
  )
}
