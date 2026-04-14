import CopyField from './CopyField.jsx'

export default function OfferSummary({ netto, mwst, brutto, gewerke = [], nachlass = null }) {
  const r2 = v => Math.round(v * 100) / 100

  // Mit Nachlass: Netto bleibt gleich (Positionssumme), Nachlass wird abgezogen
  const nettoNachNachlass = nachlass ? r2(netto - nachlass.betrag) : netto
  const effMwst = nachlass ? r2(nettoNachNachlass * 0.2) : mwst
  const effBrutto = nachlass ? r2(nettoNachNachlass + effMwst) : brutto

  return (
    <div className="card border-t-4 border-t-primary">
      <h3 className="section-title mb-4">Zusammenfassung</h3>

      {gewerke.length > 0 && (
        <div className="mb-4 space-y-1">
          {gewerke.map((g, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-50">
              <span className="text-gray-600">{g.name}</span>
              <span className="font-medium text-secondary tabular-nums">
                {Number(g.zwischensumme || 0).toFixed(2)} €
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">Netto</span>
          <div className="w-40">
            <CopyField label="" value={netto} format="currency" />
          </div>
        </div>

        {/* Nachlass-Zeile */}
        {nachlass && (
          <>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-red-50/50 -mx-4 px-4 rounded">
              <span className="text-sm text-red-600 font-medium">
                − Nachlass {nachlass.percent}%
              </span>
              <div className="w-40">
                <CopyField label="" value={nachlass.betrag} format="currency" prefix="−" />
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-secondary">Netto nach Nachlass</span>
              <div className="w-40">
                <CopyField label="" value={nettoNachNachlass} format="currency" />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">MwSt (20%)</span>
          <div className="w-40">
            <CopyField label="" value={effMwst} format="currency" />
          </div>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-base font-bold text-secondary">Brutto</span>
          <div className="w-40">
            <CopyField label="" value={effBrutto} format="currency" />
          </div>
        </div>
      </div>
    </div>
  )
}
