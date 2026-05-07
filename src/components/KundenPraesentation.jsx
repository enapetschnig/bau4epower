import { useState, useEffect } from 'react'
import {
  X, SunHorizon, BatteryFull, Plug, Thermometer, CurrencyEur, ArrowDown,
  CheckCircle, Leaf, Lightning, House, ChartLineUp, Info, Calendar, Sparkle,
  Wallet, TrendUp, ShieldCheck, ArrowSquareOut, Clock,
} from '@phosphor-icons/react'
import Logo from './Logo.jsx'

/**
 * Kunden-Präsentation: Vollbild-Verkaufspräsentation für Vorführung beim Kunden.
 * Reihenfolge: Anlage → Leistungsumfang → Wirtschaftlichkeit → Förderungen → Preis (unten).
 */
export default function KundenPraesentation({
  kunde, kwp, speicherKwh, hatWallbox, hatHeizstab,
  gruppen, totals, foerderungen = [], foerderungSumme = 0, endpreis, onClose,
}) {
  const fullName = kunde.firma || `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || 'Kunde'

  function fmt(val) {
    return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  function fmtFull(val) {
    return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // ── Wirtschaftlichkeitsberechnungen (konservative Schätzungen) ──
  const jahresertrag = Math.round(kwp * 1000)              // ~1000 kWh/kWp/Jahr (AT-konservativ)
  const co2Ersparnis = Math.round(jahresertrag * 0.4 / 100) / 10  // 0.4 kg/kWh, in t/Jahr
  const eigenverbrauch = speicherKwh > 0 ? 0.75 : 0.30     // mit Speicher 75%, ohne 30%
  const strompreis = 0.30                                   // 30 ct/kWh konservativ
  const einspeisetarif = 0.07                               // 7 ct/kWh
  const jaehrlicheErsparnis = Math.round(
    jahresertrag * eigenverbrauch * strompreis +
    jahresertrag * (1 - eigenverbrauch) * einspeisetarif
  )
  const amortisation = endpreis > 0 && jaehrlicheErsparnis > 0
    ? (endpreis / jaehrlicheErsparnis).toFixed(1)
    : null

  const ersparnisProzent = totals.brutto > 0 ? Math.round((foerderungSumme / totals.brutto) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-orange-50 via-white to-amber-50 overflow-auto">
      {/* Header sticky mit Close */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size="xs" />
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Angebot für</p>
            <p className="text-[12px] font-bold text-secondary truncate max-w-[180px] sm:max-w-none">{fullName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="bg-gray-900 text-white hover:bg-black rounded-lg px-3 py-1.5 text-[12px] font-medium flex items-center gap-1.5"
        >
          <X size={14} />
          Schließen
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* ─── HERO ─────────────────────── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl shadow-xl mb-4 relative">
            <SunHorizon size={40} weight="fill" className="text-white" />
            <Sparkle size={16} weight="fill" className="absolute -top-1 -right-1 text-amber-300" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-secondary leading-tight">
            Ihre individuelle<br/>
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">PV-Anlage</span>
          </h1>
          <p className="text-base text-gray-500 mt-3">
            Eigener Strom · Mehr Unabhängigkeit · Wertsteigerung
          </p>
        </div>

        {/* ─── ANLAGEN-DATEN ─────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
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

        {/* ─── LEISTUNGSUMFANG ─────────── */}
        <SectionTitle icon={CheckCircle} text="Was alles enthalten ist" />
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-10"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div className="space-y-4">
            {gruppen.map((g, i) => (
              <div key={i} className={i > 0 ? 'pt-4 border-t border-gray-50' : ''}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <p className="text-[15px] font-bold text-secondary">{g.name}</p>
                </div>
                <ul className="space-y-1.5 ml-9">
                  {(g.positionen || []).map((p, pi) => (
                    <li key={pi} className="flex items-start gap-2 text-[13px]">
                      <CheckCircle size={14} weight="fill" className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-secondary">{p.name}</span>
                        {p.modell && <span className="text-gray-400 text-[11px] block">{p.modell}</span>}
                        {Number(p.menge) > 1 && (
                          <span className="text-gray-400 text-[11px]">{Number(p.menge)} {p.einheit}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ─── WIRTSCHAFTLICHKEIT ─────── */}
        {jahresertrag > 0 && (
          <>
            <SectionTitle icon={ChartLineUp} text="Was die Anlage für Sie leistet" />
            <div className="grid grid-cols-2 gap-3 mb-10">
              <BenefitCard
                Icon={Lightning}
                gradient="from-amber-400 to-orange-500"
                value={fmt(jahresertrag)}
                unit="kWh"
                label="Stromproduktion / Jahr"
                desc={`Für ca. ${Math.round(jahresertrag / 4000 * 10) / 10} Haushalte`}
              />
              <BenefitCard
                Icon={Wallet}
                gradient="from-emerald-400 to-teal-500"
                value={fmt(jaehrlicheErsparnis)}
                unit="€"
                label="Ersparnis / Jahr"
                desc={speicherKwh > 0 ? '~75% Eigenverbrauch' : '~30% Eigenverbrauch'}
              />
              <BenefitCard
                Icon={Leaf}
                gradient="from-green-500 to-emerald-600"
                value={co2Ersparnis.toString().replace('.', ',')}
                unit="t"
                label="CO₂-Einsparung / Jahr"
                desc="Klimaschutz aktiv"
              />
              {amortisation && (
                <BenefitCard
                  Icon={TrendUp}
                  gradient="from-blue-500 to-indigo-600"
                  value={amortisation.replace('.', ',')}
                  unit="J."
                  label="Amortisation"
                  desc="Zahlt sich von selbst ab"
                />
              )}
            </div>
          </>
        )}

        {/* ─── VORTEILE ─────────────── */}
        <SectionTitle icon={ShieldCheck} text="Ihre Vorteile" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          <VorteilCard
            Icon={House}
            title="Mehr Unabhängigkeit"
            desc="Sie produzieren Ihren Strom selbst. Steigende Strompreise treffen Sie deutlich weniger."
          />
          <VorteilCard
            Icon={TrendUp}
            title="Wertsteigerung"
            desc="PV-Anlage und Speicher steigern den Marktwert Ihrer Immobilie nachhaltig."
          />
          <VorteilCard
            Icon={Leaf}
            title="Klimaschutz"
            desc={`Sie sparen jährlich ${co2Ersparnis.toString().replace('.', ',')} Tonnen CO₂ ein – aktiver Beitrag zur Energiewende.`}
          />
          <VorteilCard
            Icon={ShieldCheck}
            title="Versorgungssicherheit"
            desc={hatWallbox || speicherKwh > 0
              ? 'Mit Speicher und Notstrom-Funktion sind Sie auch bei Netzausfällen abgesichert.'
              : 'Saubere Stromversorgung direkt vom eigenen Dach – jeden Sonnentag.'}
          />
        </div>

        {/* ─── FÖRDERUNGEN ─────────── */}
        {foerderungen.length > 0 && (
          <>
            <SectionTitle icon={CurrencyEur} text="Mögliche Förderungen für Ihr Projekt" />
            <p className="text-[13px] text-gray-500 mb-4 text-center max-w-xl mx-auto">
              Folgende Förderungen sind für Ihre Anlage anwendbar. Wir unterstützen Sie bei der Antragsstellung.
            </p>

            <div className="space-y-3 mb-10">
              {foerderungen.map((f, i) => (
                <FoerderungCard key={f.id} foerderung={f} index={i + 1} />
              ))}
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-10 flex items-start gap-3">
              <Info size={18} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-amber-900">Wichtiger Hinweis</p>
                <p className="text-[12px] text-amber-800 leading-relaxed mt-1">
                  Förderbeträge sind Schätzwerte basierend auf aktuellen Förderprogrammen. Die tatsächliche
                  Höhe ergibt sich aus den jeweils gültigen Förderbedingungen, verfügbaren Kontingenten und
                  Antragszeitpunkten. Förderanträge müssen <strong>vor</strong> Auftragserteilung gestellt werden.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════ */}
        {/* ─── INVESTITION (PREIS GANZ UNTEN) ─── */}
        {/* ═══════════════════════════════ */}
        <SectionTitle icon={Wallet} text="Ihre Investition" />

        <div className="space-y-3 mb-10">
          {/* Bruttobetrag */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div>
              <p className="text-[12px] text-gray-500">Investition gesamt</p>
              <p className="text-[10px] text-gray-400">inkl. 20% MwSt.</p>
            </div>
            <p className="text-2xl font-bold text-secondary">
              {fmt(totals.brutto)} <span className="text-sm text-gray-400">€</span>
            </p>
          </div>

          {foerderungSumme > 0 && (
            <>
              {/* Förderung-Block */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <CurrencyEur size={16} weight="bold" className="text-white" />
                  </div>
                  <p className="text-[13px] font-bold text-emerald-900">Abzüglich Ihrer Förderungen</p>
                </div>
                <div className="space-y-1 ml-10">
                  {foerderungen.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="text-emerald-800 truncate flex-1">– {f.name}</span>
                      <span className="font-bold text-emerald-700 whitespace-nowrap">
                        −{fmt(f._berechnet)} €
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-emerald-200 mt-2 pt-2 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-emerald-900">Förderung gesamt</span>
                    <span className="text-[16px] font-extrabold text-emerald-700">
                      −{fmt(foerderungSumme)} €
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center py-1">
                <div className="bg-white rounded-full p-2 shadow-sm">
                  <ArrowDown size={20} weight="bold" className="text-orange-500" />
                </div>
              </div>
            </>
          )}

          {/* ─ ENDPREIS – DER STAR ─ */}
          <div className="bg-gradient-to-br from-gray-900 via-secondary to-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden">
            {/* Decoration */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-orange-500 opacity-20 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-400 opacity-20 rounded-full blur-2xl" />

            <div className="relative z-10 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-60 mb-3 font-medium">
                {foerderungSumme > 0 ? 'Ihr Preis nach Förderung' : 'Ihre Investition'}
              </p>
              <p className="text-5xl sm:text-7xl font-extrabold leading-none mb-3 bg-gradient-to-r from-orange-300 to-amber-200 bg-clip-text text-transparent">
                {fmt(foerderungSumme > 0 ? endpreis : totals.brutto)}
                <span className="text-3xl sm:text-4xl text-white ml-1">€</span>
              </p>
              {foerderungSumme > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/20">
                  <Sparkle size={12} weight="fill" className="text-amber-300" />
                  <span className="text-[12px] font-semibold">
                    Sie sparen {fmt(foerderungSumme)} € · {ersparnisProzent}%
                  </span>
                </div>
              )}
              {jaehrlicheErsparnis > 0 && (
                <p className="text-[11px] opacity-70 mt-3">
                  ≈ {fmt(jaehrlicheErsparnis)} € Stromkostenersparnis pro Jahr
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── FOOTER ─────────── */}
        <div className="text-center pt-4 pb-8 border-t border-gray-100">
          <p className="text-[12px] text-gray-500 mb-2">
            Wir freuen uns auf Ihre Auftragserteilung.
          </p>
          <p className="text-[11px] text-gray-400 mb-3">
            Angebot 60 Tage gültig
          </p>
          <Logo size="sm" className="inline-block opacity-60" />
          <p className="text-[10px] text-gray-300 mt-2">
            ET KÖNIG GmbH · Frojacher Straße 5 · 8841 Frojach<br/>
            office@etkoenig.at · www.et-koenig.at
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px bg-gradient-to-r from-transparent to-gray-300 flex-1" />
      <div className="flex items-center gap-2">
        <Icon size={18} weight="fill" className="text-primary" />
        <h2 className="text-base sm:text-lg font-bold text-secondary">{text}</h2>
      </div>
      <div className="h-px bg-gradient-to-l from-transparent to-gray-300 flex-1" />
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

function BenefitCard({ Icon, gradient, value, unit, label, desc }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 relative overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 bg-gradient-to-br ${gradient}`} />
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 relative z-10`}>
        <Icon size={18} weight="fill" className="text-white" />
      </div>
      <p className="text-2xl font-extrabold text-secondary leading-none relative z-10">
        {value}
        {unit && <span className="text-base text-gray-500 ml-1">{unit}</span>}
      </p>
      <p className="text-[11px] text-gray-700 font-semibold mt-1 relative z-10">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 relative z-10">{desc}</p>
    </div>
  )
}

function VorteilCard({ Icon, title, desc }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon size={18} weight="fill" className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-secondary">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function FoerderungCard({ foerderung, index }) {
  const [expanded, setExpanded] = useState(false)
  const f = foerderung

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-100 overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(16,185,129,0.08)' }}>
      <div className="p-4 bg-gradient-to-br from-emerald-50/50 to-teal-50/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
            {String(index).padStart(2, '0')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-secondary leading-tight">{f.name}</p>
            {f.beschreibung && (
              <p className="text-[11px] text-gray-500 mt-0.5">{f.beschreibung}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[18px] font-extrabold text-emerald-600 leading-none">
              {Number(f._berechnet).toLocaleString('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
            </p>
            <p className="text-[9px] text-emerald-700 uppercase tracking-wider mt-0.5">Förderung</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {/* Begründung */}
        {f.begruendung && (
          <TipBlock
            Icon={Info}
            iconColor="text-blue-500"
            bgColor="bg-blue-50"
            title="Wie kommt der Betrag zustande?"
            text={f.begruendung}
          />
        )}

        {/* Call-Zeitraum */}
        {f.call_zeitraum && (
          <TipBlock
            Icon={Calendar}
            iconColor="text-amber-600"
            bgColor="bg-amber-50"
            title="Wann ist der Förder-Call?"
            text={f.call_zeitraum}
          />
        )}

        {/* Antragstelle */}
        {f.antragstelle && (
          <TipBlock
            Icon={ShieldCheck}
            iconColor="text-emerald-600"
            bgColor="bg-emerald-50"
            title="Wo wird beantragt?"
            text={f.antragstelle}
            link={f.link}
          />
        )}

        {/* Hinweis */}
        {f.hinweis && (
          <TipBlock
            Icon={Sparkle}
            iconColor="text-purple-500"
            bgColor="bg-purple-50"
            title="Tipp"
            text={f.hinweis}
          />
        )}
      </div>
    </div>
  )
}

function TipBlock({ Icon, iconColor, bgColor, title, text, link }) {
  return (
    <div className={`${bgColor} rounded-lg p-3 flex items-start gap-2`}>
      <Icon size={14} weight="fill" className={`${iconColor} mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-secondary">{title}</p>
        <p className="text-[11px] text-gray-700 mt-0.5 leading-relaxed">{text}</p>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold mt-1 hover:underline">
            Mehr Infos <ArrowSquareOut size={10} weight="bold" />
          </a>
        )}
      </div>
    </div>
  )
}
