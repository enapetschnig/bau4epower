import { X, SunHorizon, BatteryFull, Plug, Thermometer, CurrencyEur, ArrowDown, CheckCircle } from '@phosphor-icons/react'

/**
 * Kunden-Präsentation: Vollbild-Modus für Vorführung beim Kunden.
 * Große Zahlen, optisch ansprechend, fokussiert auf den Endpreis nach Förderung.
 */
export default function KundenPraesentation({
  kunde, kwp, speicherKwh, hatWallbox, hatHeizstab,
  gruppen, totals, foerderungen, foerderungSumme, endpreis, onClose,
}) {
  const fullName = kunde.firma || `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || 'Kunde'

  function fmt(val) {
    return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  function fmtFull(val) {
    return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const hatFoerderung = foerderungSumme > 0
  const ersparnisProzent = totals.brutto > 0 ? Math.round((foerderungSumme / totals.brutto) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Header mit Close-Button */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Angebot für</p>
          <p className="text-[14px] font-bold text-secondary truncate max-w-[200px] sm:max-w-none">{fullName}</p>
        </div>
        <button
          onClick={onClose}
          className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 text-[12px] font-medium text-secondary flex items-center gap-1.5"
        >
          <X size={14} />
          Schließen
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* TITEL */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl shadow-lg mb-4">
            <SunHorizon size={40} weight="fill" className="text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary leading-tight">
            Ihre PV-Anlage
          </h1>
          <p className="text-base text-gray-500 mt-2">
            Photovoltaik · Speicher · Förderung
          </p>
        </div>

        {/* ANLAGEN-INFO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          <InfoCard
            Icon={SunHorizon}
            value={kwp.toFixed(2).replace('.', ',')}
            unit="kWp"
            label="Anlagengröße"
            iconColor="text-amber-500"
            bgColor="bg-amber-50"
          />
          {speicherKwh > 0 && (
            <InfoCard
              Icon={BatteryFull}
              value={speicherKwh.toFixed(0)}
              unit="kWh"
              label="Speicher"
              iconColor="text-emerald-500"
              bgColor="bg-emerald-50"
            />
          )}
          {hatWallbox && (
            <InfoCard
              Icon={Plug}
              value="✓"
              label="Wallbox"
              iconColor="text-blue-500"
              bgColor="bg-blue-50"
            />
          )}
          {hatHeizstab && (
            <InfoCard
              Icon={Thermometer}
              value="✓"
              label="PV-Heizstab"
              iconColor="text-rose-500"
              bgColor="bg-rose-50"
            />
          )}
        </div>

        {/* PREIS-KASKADE */}
        <div className="space-y-1.5 mb-8">
          {/* Brutto */}
          <PriceRow
            label="Investition gesamt (Brutto)"
            value={totals.brutto}
            sub="inkl. 20% MwSt."
          />

          {/* Förderungen */}
          {hatFoerderung && (
            <>
              <div className="flex items-center justify-center py-2">
                <ArrowDown size={20} className="text-emerald-500" />
              </div>

              {/* Förderungs-Details */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border-2 border-emerald-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <CurrencyEur size={16} weight="bold" className="text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] text-emerald-700 uppercase tracking-wider font-semibold">Ihre Förderungen</p>
                    <p className="text-[13px] text-emerald-900 font-bold">
                      {foerderungen.length} {foerderungen.length === 1 ? 'Förderung' : 'Förderungen'} möglich
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {foerderungen.map(f => (
                    <div key={f.id} className="flex items-start justify-between gap-3 py-1">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <CheckCircle size={14} weight="fill" className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[13px] text-emerald-900 font-medium">{f.name}</p>
                          {f.beschreibung && (
                            <p className="text-[11px] text-emerald-700/80 truncate">{f.beschreibung}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[14px] font-bold text-emerald-700 whitespace-nowrap">
                        −{fmt(f._berechnet)} €
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-emerald-200 mt-3 pt-3 flex items-center justify-between">
                  <p className="text-[14px] font-bold text-emerald-900">Förderung gesamt</p>
                  <p className="text-[20px] font-extrabold text-emerald-600">
                    {fmt(foerderungSumme)} €
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center py-2">
                <ArrowDown size={20} className="text-primary" />
              </div>

              {/* Endpreis - prominenter Block */}
              <div className="bg-gradient-to-br from-primary to-orange-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-white text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-80 mb-2">Ihr Endpreis nach Förderung</p>
                <p className="text-5xl sm:text-6xl font-extrabold leading-none mb-2">
                  {fmt(endpreis)} <span className="text-3xl sm:text-4xl">€</span>
                </p>
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mt-2">
                  <span className="text-[12px] font-semibold">
                    Sie sparen {fmt(foerderungSumme)} € ({ersparnisProzent}%)
                  </span>
                </div>
              </div>
            </>
          )}

          {!hatFoerderung && (
            <div className="bg-gradient-to-br from-primary to-orange-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-white text-center mt-3">
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-80 mb-2">Investition gesamt</p>
              <p className="text-5xl sm:text-6xl font-extrabold leading-none mb-2">
                {fmt(totals.brutto)} <span className="text-3xl sm:text-4xl">€</span>
              </p>
            </div>
          )}
        </div>

        {/* LEISTUNGSUMFANG */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Leistungsumfang</p>
          <div className="space-y-3">
            {gruppen.map((g, i) => {
              const sum = (g.positionen || []).reduce((s, p) => s + (p.menge || 0) * (p.preis || 0), 0)
              return (
                <div key={i} className="flex items-start justify-between gap-4 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-secondary">{g.name}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {(g.positionen || []).map((p, pi) => (
                        <li key={pi} className="text-[12px] text-gray-500 flex items-center gap-1.5">
                          <span className="text-emerald-500">✓</span>
                          <span className="truncate">{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[14px] font-bold text-secondary whitespace-nowrap">
                    {fmtFull(sum)} €
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* HINWEIS */}
        <div className="text-center pt-2 pb-8">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Förderbeträge sind Schätzwerte – die tatsächliche Höhe ergibt sich aus<br className="hidden sm:block"/>
            den jeweils gültigen Förderbedingungen und verfügbaren Kontingenten.
          </p>
          <p className="text-[10px] text-gray-300 mt-2">
            Angebot von ET KÖNIG GmbH · 8841 Frojach
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ Icon, value, unit, label, iconColor, bgColor }) {
  return (
    <div className={`${bgColor} rounded-2xl p-4 text-center`}>
      <div className="inline-flex items-center justify-center w-9 h-9 bg-white rounded-lg shadow-sm mb-2">
        <Icon size={18} weight="fill" className={iconColor} />
      </div>
      <p className="text-2xl font-extrabold text-secondary leading-none">
        {value}
        {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
      </p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

function PriceRow({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div>
        <p className="text-[14px] font-semibold text-secondary">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <p className="text-2xl font-bold text-secondary">
        {Number(value || 0).toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        <span className="text-base text-gray-400 ml-1">€</span>
      </p>
    </div>
  )
}
