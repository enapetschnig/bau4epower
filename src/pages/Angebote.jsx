import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SpinnerGap, Trash } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { loadOffers, deleteOffer } from '../lib/offers.js'
import { deleteOfferMedia } from '../lib/media.js'

const STATUS_LABEL = {
  entwurf: 'Entwurf',
  gesendet: 'Gesendet',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  draft: 'Entwurf',
}

const STATUS_COLOR = {
  entwurf: 'bg-gray-100 text-gray-500',
  gesendet: 'bg-blue-100 text-blue-700',
  in_bearbeitung: 'bg-orange-100 text-orange-700',
  abgeschlossen: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-500',
}

function Spinner() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 flex justify-center">
      <SpinnerGap size={32} weight="bold" className="text-primary animate-spin" />
    </div>
  )
}

export default function Angebote({ embedded = false }) {
  const { user, isAdmin } = useAuth()
  const { showToast } = useToast()
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    loadOffers(user.id, isAdmin)
      .then(data => {
        const STATUS_ORDER = { entwurf: 0, draft: 0, in_bearbeitung: 1, gesendet: 1, abgeschlossen: 2 }
        const sorted = [...data].sort((a, b) => {
          const sa = STATUS_ORDER[a.status] ?? 0
          const sb = STATUS_ORDER[b.status] ?? 0
          if (sa !== sb) return sa - sb
          return new Date(b.created_at) - new Date(a.created_at)
        })
        setOffers(sorted)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user, isAdmin])

  async function handleDelete(id) {
    const confirmed = window.confirm('Angebot wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')
    if (!confirmed) return
    setDeleting(true)
    try {
      await deleteOfferMedia(id)
      await deleteOffer(id)
      setOffers(prev => prev.filter(o => o.id !== id))
      showToast('Angebot gelöscht')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-2xl mx-auto px-4 py-6 space-y-4'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={`font-bold text-secondary ${embedded ? 'text-lg' : 'text-xl'}`}>
          {isAdmin ? 'Alle Angebote' : 'Meine Angebote'}
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{offers.length} gespeichert</span>
          <Link to="/kalkulation?modus=2" className="btn-primary text-sm py-2 px-4">
            + Neu
          </Link>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border border-red-200 text-red-600 text-sm py-3 px-4">
          {error}
        </div>
      )}

      {!error && offers.length === 0 && (
        <div className="card py-12 text-center space-y-4">
          <div className="text-4xl">🗂️</div>
          <p className="text-gray-500 font-medium">Noch keine Angebote gespeichert</p>
          <p className="text-sm text-gray-400">Erstelle ein neues Angebot und speichere es ab.</p>
          <Link to="/kalkulation?modus=2" className="btn-primary inline-block">
            Neues Angebot erstellen
          </Link>
        </div>
      )}

      {offers.length > 0 && (
        <div className="space-y-2">
          {offers.map(offer => {
            const adresse = offer.angebot_data?._adresse || ''
            const status = offer.status || 'entwurf'
            const netto = Number(offer.gesamtsumme_netto || 0)
            const datumFormatiert = new Date(offer.created_at).toLocaleDateString('de-AT', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })

            return (
              <div key={offer.id} className="card flex items-start gap-2">
                <Link
                  to={`/kalkulation?modus=2&offerId=${offer.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {offer.hero_projektnummer && (
                        <p className="text-xs font-mono font-semibold text-primary">
                          Projekt {offer.hero_projektnummer}
                        </p>
                      )}
                      {adresse && (
                        <p className="text-xs text-gray-500 truncate">{adresse}</p>
                      )}
                      <p className="font-semibold text-secondary text-sm leading-snug">
                        {offer.betrifft || 'Angebot'}
                      </p>
                      <p className="text-xs text-gray-400">{datumFormatiert}</p>
                      {(() => {
                        const mc = offer.offer_media?.[0]?.count || 0
                        return mc > 0 ? (
                          <p className="text-xs text-gray-400">📷 {mc}</p>
                        ) : null
                      })()}
                      {(() => {
                        const ec = (offer.ergaenzungen || []).length
                        return ec > 0 ? (
                          <p className="text-xs text-blue-500">📝 {ec} Ergänzung{ec !== 1 ? 'en' : ''}</p>
                        ) : null
                      })()}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${STATUS_COLOR[status] || STATUS_COLOR.entwurf}`}>
                        {STATUS_LABEL[status] || status}
                      </span>
                      <p className="text-sm font-bold text-secondary tabular-nums whitespace-nowrap">
                        {netto.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </p>
                      <p className="text-xs text-gray-400">netto</p>
                    </div>
                  </div>
                </Link>

                <button
                  onClick={e => { e.preventDefault(); handleDelete(offer.id) }}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 active:text-red-500 active:bg-red-50 transition-colors mt-0.5"
                  title="Angebot löschen"
                >
                  <Trash size={18} weight="regular" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
