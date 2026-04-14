import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Robot, Users } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import PromptManager from './PromptManager.jsx'
import UserManager from './UserManager.jsx'

const TABS = [
  { id: 'prompts', label: 'Prompts', Icon: Robot },
  { id: 'users', label: 'Benutzer', Icon: Users },
]

export default function Admin() {
  const { isAdmin, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('prompts')

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <h1 className="section-title">Admin-Bereich</h1>

      {/* Tabs */}
      <div className="card p-2">
        <div className="grid grid-cols-2 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all
                ${activeTab === tab.id ? 'bg-secondary text-white' : 'text-gray-500 active:bg-gray-100'}`}
            >
              <tab.Icon size={18} weight="regular" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'prompts' && <PromptManager />}
      {activeTab === 'users' && <UserManager />}
    </div>
  )
}
