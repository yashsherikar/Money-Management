import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const emptyForm = { name: '', price: '', productUrl: '', groupId: '' }

export default function Wishlist() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [affordability, setAffordability] = useState({}) // itemId -> data
  const [requestOpenFor, setRequestOpenFor] = useState(null)
  const [requestAmounts, setRequestAmounts] = useState({}) // memberId -> amount

  async function loadAll() {
    const [itemsRes, groupsRes] = await Promise.all([client.get('/wishlist'), client.get('/groups')])
    setItems(itemsRes.data)
    setGroups(groupsRes.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    try {
      await client.post('/wishlist', {
        name: form.name,
        price: Number(form.price),
        productUrl: form.productUrl || null,
        groupId: form.groupId ? Number(form.groupId) : null,
      })
      setForm(emptyForm)
      loadAll()
    } catch (err) {
      setError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('Remove this wishlist item?'))) return
    await client.delete(`/wishlist/${id}`)
    loadAll()
  }

  async function checkAffordability(item) {
    const { data } = await client.get(`/wishlist/${item.id}/affordability`)
    setAffordability((prev) => ({ ...prev, [item.id]: data }))
  }

  function openRequestForm(item) {
    const group = groups.find((g) => g.id === item.groupId)
    const others = group ? group.members.filter((m) => m.userId !== user?.id) : []
    const shortfall = affordability[item.id]?.shortfall ?? 0
    const share = others.length ? (Number(shortfall) / others.length).toFixed(2) : '0'
    const initial = {}
    others.forEach((m) => { initial[m.userId] = share })
    setRequestAmounts(initial)
    setRequestOpenFor(item.id)
  }

  async function submitRequests(item) {
    const group = groups.find((g) => g.id === item.groupId)
    const others = group ? group.members.filter((m) => m.userId !== user?.id) : []
    const requests = others
      .map((m) => ({ memberId: m.userId, amount: Number(requestAmounts[m.userId]) }))
      .filter((r) => r.amount > 0)
    if (requests.length === 0) return
    await client.post(`/wishlist/${item.id}/contribution-requests`, { requests })
    setRequestOpenFor(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('Wishlist')}</h1>

      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input required placeholder={t('Item name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input required type="number" step="0.01" min="0.01" placeholder={t('Price')} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <input placeholder={t('Product link (optional)')} value={form.productUrl} onChange={(e) => setForm({ ...form, productUrl: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
        <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md">
          <option value="">{t('No group (just for me)')}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium md:col-span-4">{t('Add to wishlist')}</button>
        {error && <div className="md:col-span-4 text-sm text-red-600">{error}</div>}
      </form>

      <div className="space-y-4">
        {items.length === 0 && <div className="text-sm text-slate-500">{t('Nothing on your wishlist yet.')}</div>}
        {items.map((item) => {
          const a = affordability[item.id]
          return (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {item.productUrl ? (
                      <a href={item.productUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{item.name}</a>
                    ) : item.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {money(item.price)} · {item.status}{item.groupName ? ` · ${item.groupName}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => checkAffordability(item)} className="text-sm text-brand-600">{t('Check affordability')}</button>
                  <button onClick={() => handleDelete(item.id)} className="text-sm text-red-600">{t('Delete')}</button>
                </div>
              </div>

              {a && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600 mb-2">
                    <span>{t('Available funds:')} <strong>{money(a.availableFunds)}</strong></span>
                    {Number(a.shortfall) > 0 && <span>{t('Shortfall:')} <strong className="text-red-600">{money(a.shortfall)}</strong></span>}
                  </div>
                  <p className={a.comfortable ? 'text-emerald-600' : a.affordable ? 'text-amber-600' : 'text-red-600'}>{a.recommendation}</p>

                  {Number(a.shortfall) > 0 && item.groupId && (
                    <div className="mt-3">
                      {requestOpenFor === item.id ? (
                        <div className="space-y-2">
                          {groups.find((g) => g.id === item.groupId)?.members
                            .filter((m) => m.userId !== user?.id)
                            .map((m) => (
                              <div key={m.userId} className="flex items-center gap-2">
                                <span className="w-32 truncate">{m.name}</span>
                                <input
                                  type="number" step="0.01" min="0"
                                  value={requestAmounts[m.userId] || ''}
                                  onChange={(e) => setRequestAmounts({ ...requestAmounts, [m.userId]: e.target.value })}
                                  className="px-2 py-1 border border-slate-300 rounded-md w-28"
                                />
                              </div>
                            ))}
                          <div className="flex gap-2">
                            <button onClick={() => submitRequests(item)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">{t('Send requests')}</button>
                            <button onClick={() => setRequestOpenFor(null)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-md">{t('Cancel')}</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openRequestForm(item)} className="text-sm text-brand-600">{t('Request the shortfall from group members')}</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
