import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'

export default function PageHeader({ title, subtitle, action, backTo }) {
  const navigate = useNavigate()

  function handleBack() {
    if (backTo) navigate(backTo)
    else navigate(-1)
  }

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-16 z-30 flex items-center gap-2">
      <button
        onClick={handleBack}
        className="touch-btn text-gray-500 hover:text-secondary -ml-2"
        aria-label="Zurück"
      >
        <ArrowLeft size={18} weight="bold" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-[14px] font-bold text-secondary truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
