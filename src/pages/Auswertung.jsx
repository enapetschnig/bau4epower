import { ChartLine } from '@phosphor-icons/react'

export default function Auswertung() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
        <ChartLine size={22} weight="fill" className="text-indigo-500" />
      </div>
      <h1 className="text-base font-bold text-secondary">Stundenauswertung</h1>
      <p className="text-[12px] text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
        Analyse aller Mitarbeiter-Stunden und Projekt-Auswertungen – wird in Kürze verfügbar sein.
      </p>
    </div>
  )
}
