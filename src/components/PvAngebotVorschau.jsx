import { X, CurrencyEur } from '@phosphor-icons/react'

export default function PvAngebotVorschau({
  kunde, datum, gruppen, totals,
  foerderungen = [], foerderungSumme = 0, endpreis = null,
  onClose,
}) {
  const fmt = (val) => Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtMenge = (val) => Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatDate = (d) => new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const fullName = kunde.firma || `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || '–'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-secondary">Vorschau Angebot</h2>
            <p className="text-[11px] text-gray-400">So wird das PDF aussehen</p>
          </div>
          <button onClick={onClose} className="touch-btn text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* PDF-Like Preview */}
        <div className="flex-1 overflow-auto bg-gray-100 p-3 sm:p-6">
          <div className="bg-white shadow-lg max-w-2xl mx-auto p-6 sm:p-10" style={{ minHeight: '40vh' }}>
            {/* Letter-Header */}
            <div className="flex items-start justify-between gap-4 pb-4">
              <img src="/logo-etk.png" alt="ET KÖNIG" className="h-14" />
              <div className="text-right text-[9px] text-gray-700 leading-tight">
                <p className="italic">Elektroinstallation • Photovoltaik • Blitzschutz • Alarmanlagen •</p>
                <p className="italic">Sat-Anlagen • KNX/EIB • Gas – Wasser – Heizung</p>
                <p className="text-primary font-bold mt-1.5">EINEN HERZSCHLAG VORAUS</p>
              </div>
            </div>

            {/* Spacer */}
            <div className="h-12" />

            {/* Customer + Beleg-Box */}
            <div className="flex items-start justify-between gap-4 mb-8">
              <div className="text-[11px] text-gray-800">
                <p>{kunde.anrede || 'Herr'}</p>
                <p className="font-semibold">{fullName}</p>
                {kunde.strasse && <p>{kunde.strasse}</p>}
                {(kunde.plz || kunde.ort) && <p>{kunde.plz} {kunde.ort}</p>}
              </div>
              <div className="border border-gray-700">
                <div className="grid grid-cols-3 text-center text-[10px]">
                  <div className="border-r border-gray-700 px-3 py-1 font-bold">Beleg-Nr.</div>
                  <div className="border-r border-gray-700 px-3 py-1 font-bold">Datum</div>
                  <div className="px-3 py-1 font-bold">Kd-Nr.</div>
                  <div className="border-r border-t border-gray-700 px-3 py-1.5">XXXXNNNN</div>
                  <div className="border-r border-t border-gray-700 px-3 py-1.5">{formatDate(datum)}</div>
                  <div className="border-t border-gray-700 px-3 py-1.5">{kunde.kd_nr || '–'}</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold text-gray-900 mb-1">Angebot Nr.: <span className="text-primary">XXXXNNNN</span></h1>
            <p className="text-[10px] text-gray-600">UID-Nr. des Leistungsempfängers lt. RLG:{kunde.uid_nummer ? ' ' + kunde.uid_nummer : ''}</p>
            <p className="text-[12px] font-bold text-gray-900 mt-1 mb-4">Materialangebot</p>

            {/* Position Table */}
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-1 px-1 font-bold">Pos.Nr.</th>
                  <th className="text-right py-1 px-1 font-bold">Menge</th>
                  <th className="text-left py-1 px-1 font-bold">Einh.</th>
                  <th className="text-left py-1 px-1 font-bold">Beschreibung</th>
                  <th className="text-right py-1 px-1 font-bold">Preis</th>
                  <th className="text-right py-1 px-1 font-bold">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {gruppen.map((g, gi) => {
                  const grpNr = String(gi + 1).padStart(2, '0')
                  const grpSum = (g.positionen || []).reduce((s, p) => s + (p.menge || 0) * (p.preis || 0), 0)
                  return (
                    <>
                      {/* Group Header */}
                      <tr key={`gh-${gi}`} className="border-b border-gray-100">
                        <td className="py-2 px-1 font-bold align-top">{grpNr}</td>
                        <td colSpan={2} />
                        <td className="py-2 px-1 font-bold">{g.name}</td>
                        <td colSpan={2} />
                      </tr>
                      {/* Positions */}
                      {(g.positionen || []).map((p, pi) => {
                        const posNr = `${grpNr}.${String(pi + 1).padStart(3, '0')}`
                        const ges = (p.menge || 0) * (p.preis || 0)
                        return (
                          <tr key={`p-${gi}-${pi}`} className="border-b border-gray-50">
                            <td className="py-1.5 px-1 align-top">{posNr}</td>
                            <td className="py-1.5 px-1 text-right align-top">{fmtMenge(p.menge)}</td>
                            <td className="py-1.5 px-1 align-top">{p.einheit}</td>
                            <td className="py-1.5 px-1 align-top">
                              <div>{p.name}</div>
                              {p.modell && <div className="text-gray-500">{p.modell}</div>}
                            </td>
                            <td className="py-1.5 px-1 text-right align-top">{fmt(p.preis)}</td>
                            <td className="py-1.5 px-1 text-right align-top">{fmt(ges)}</td>
                          </tr>
                        )
                      })}
                      {/* Group Total */}
                      <tr key={`gt-${gi}`} className="border-b border-gray-200">
                        <td className="py-1.5 px-1 font-bold align-top">{grpNr}</td>
                        <td colSpan={2} />
                        <td className="py-1.5 px-1 font-bold">Summe: {g.name}</td>
                        <td />
                        <td className="py-1.5 px-1 text-right font-bold">{fmt(grpSum)}</td>
                      </tr>
                    </>
                  )
                })}
              </tbody>
            </table>

            {/* Gruppenzusammenstellung */}
            {gruppen.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-bold text-gray-900 tracking-widest mb-2">G R U P P E N Z U S A M M E N S T E L L U N G</p>
                <table className="w-full text-[10px]">
                  <tbody>
                    {gruppen.map((g, gi) => {
                      const grpSum = (g.positionen || []).reduce((s, p) => s + (p.menge || 0) * (p.preis || 0), 0)
                      return (
                        <tr key={gi}>
                          <td className="py-0.5 w-10">{String(gi + 1).padStart(2, '0')}</td>
                          <td className="py-0.5">{g.name}</td>
                          <td className="py-0.5 text-right">{fmt(grpSum)}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-gray-700"><td colSpan={3} className="pt-2" /></tr>
                    <tr>
                      <td />
                      <td className="py-0.5">Nettobetrag</td>
                      <td className="py-0.5 text-right">[EUR] {fmt(totals.netto)}</td>
                    </tr>
                    <tr>
                      <td />
                      <td className="py-0.5">Mwst 20,00 %</td>
                      <td className="py-0.5 text-right">[EUR] {fmt(totals.mwst)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td />
                      <td className="py-1">Bruttobetrag</td>
                      <td className="py-1 text-right">[EUR] {fmt(totals.brutto)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Förderungs-Block */}
            {foerderungen.length > 0 && (
              <div className="mt-6 border-t-2 border-emerald-200 pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CurrencyEur size={12} weight="bold" className="text-emerald-600" />
                  <p className="text-[10px] font-bold text-emerald-700 tracking-widest uppercase">Verfügbare Förderungen</p>
                </div>
                <table className="w-full text-[10px]">
                  <tbody>
                    {foerderungen.map(f => (
                      <tr key={f.id} className="text-emerald-800">
                        <td className="py-0.5 pl-3">– {f.name}</td>
                        <td className="py-0.5 text-right">−{fmt(f._berechnet)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-emerald-100">
                      <td className="py-1 pl-3 text-emerald-700">Förderung gesamt</td>
                      <td className="py-1 text-right text-emerald-700">−{fmt(foerderungSumme)} €</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-primary rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Endpreis nach Förderung</span>
                    <span className="text-[16px] font-extrabold text-primary">{fmt(endpreis ?? totals.brutto)} €</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 text-[10px] text-gray-700 space-y-2">
              <p>Wir hoffen, dass unser Angebot Ihren Vorstellungen entspricht und würden uns über eine Auftragserteilung Ihrerseits sehr freuen.</p>
              <p>Der Angebotspreis ist 60 Tage gültig.</p>
              {foerderungen.length > 0 && (
                <p className="text-[9px] text-gray-500 italic mt-2">
                  Hinweis: Förderbeträge sind Schätzwerte – die tatsächliche Höhe ergibt sich aus den jeweils gültigen Förderbedingungen und verfügbaren Kontingenten.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary w-full">
            Schließen & Anpassen
          </button>
        </div>
      </div>
    </div>
  )
}
