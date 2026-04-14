import { ArrowsLeftRight, Wrench, Clock } from '@phosphor-icons/react'

export default function Delegieren() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center text-center gap-6 min-h-[60vh] justify-center">

      {/* Icon */}
      <div className="w-24 h-24 bg-secondary rounded-3xl flex items-center justify-center shadow-lg">
        <ArrowsLeftRight size={48} weight="fill" className="text-white" />
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-secondary">Delegieren</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
          Dieser Bereich wird gerade von Christoph entwickelt und steht bald zur Verfügung.
        </p>
      </div>

      {/* Status Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Wrench size={22} weight="fill" className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary">In Entwicklung</p>
            <p className="text-xs text-gray-400">Christoph Lapecznik arbeitet an diesem Bereich</p>
          </div>
        </div>

        <div className="border-t border-gray-50 pt-4 flex items-center gap-3 text-left">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock size={22} weight="fill" className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary">Bald verfügbar</p>
            <p className="text-xs text-gray-400">Mail, WhatsApp &amp; mehr</p>
          </div>
        </div>
      </div>

    </div>
  )
}
