import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Groups() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [groups, setGroups] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  async function load() {
    const { data } = await client.get('/groups')
    setGroups(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function createGroup(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/groups', { name })
      setName('')
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Could not create group'))
    }
  }

  async function joinGroup(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/groups/join', { inviteCode: code })
      setCode('')
      load()
    } catch (err) {
      setError(err.response?.data?.message || t('Could not join group'))
    }
  }

  function copyCode(group) {
    navigator.clipboard?.writeText(group.inviteCode)
    setCopiedId(group.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Groups')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <form onSubmit={createGroup} className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">{t('Create a group')}</h2>
          <div className="flex gap-2">
            <input required placeholder={t('e.g. Flat 4B')} value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-md" />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">{t('Create')}</button>
          </div>
        </form>
        <form onSubmit={joinGroup} className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">{t('Join with invite code')}</h2>
          <div className="flex gap-2">
            <input required placeholder={t('8-character code')} value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-md uppercase" />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">{t('Join')}</button>
          </div>
        </form>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="space-y-4">
        {groups.length === 0 && <div className="text-sm text-slate-500">{t('No groups yet. Create one or join with a code.')}</div>}
        {groups.map((g) => (
          <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{g.name}</div>
              <button onClick={() => copyCode(g)} className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                {copiedId === g.id ? t('Copied!') : `${t('Code:')} ${g.inviteCode}`}
              </button>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              {g.members.map((m) => (
                <div key={m.userId} className="flex justify-between">
                  <span>{m.name}{m.userId === user?.id ? ` (${t('you')})` : ''}</span>
                  <span className="text-slate-400">{m.email}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
