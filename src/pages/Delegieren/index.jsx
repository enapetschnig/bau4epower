import { ArrowsLeftRight } from '@phosphor-icons/react'

export default function Delegieren() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
        <ArrowsLeftRight size={22} weight="regular" className="text-gray-400" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-secondary">Delegieren</p>
        <p className="text-[11px] text-gray-400 mt-1 max-w-[240px] mx-auto leading-relaxed">
          Dieser Bereich wird gerade entwickelt und steht bald zur Verfügung.
        </p>
      </div>
    </div>
  )
}
