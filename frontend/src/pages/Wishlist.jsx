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

  const [wishroom, setWishroom] = useState({ connected: false, email: '', name: '' })
  const [wishroomForm, setWishroomForm] = useState({ email: '', password: '' })
  const [wishroomError, setWishroomError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [wishroomRooms, setWishroomRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [wishroomItems, setWishroomItems] = useState([])
  const [importGroupId, setImportGroupId] = useState('')

  async function loadAll() {
    const [itemsRes, groupsRes, wishroomRes] = await Promise.all([
      client.get('/wishlist'),
      client.get('/groups'),
      client.get('/wishroom/status'),
    ])
    setItems(itemsRes.data)
    setGroups(groupsRes.data)
    setWishroom(wishroomRes.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleWishroomConnect(e) {
    e.preventDefault()
    setWishroomError('')
    try {
      const { data } = await client.post('/wishroom/connect', wishroomForm)
      setWishroom(data)
      setWishroomForm({ email: '', password: '' })
    } catch (err) {
      setWishroomError(err.response?.data?.message || t('Save failed'))
    }
  }

  async function handleWishroomDisconnect() {
    await client.delete('/wishroom/connect')
    setWishroom({ connected: false, email: '', name: '' })
    setImportOpen(false)
  }

  async function openImportPanel() {
    setImportOpen(true)
    setWishroomItems([])
    setSelectedRoomId('')
    const { data } = await client.get('/wishroom/rooms')
    setWishroomRooms(data)
  }

  async function selectRoom(roomId) {
    setSelectedRoomId(roomId)
    const { data } = await client.get(`/wishroom/rooms/${roomId}/items`)
    setWishroomItems(data)
  }

  async function importWishroomItem(item) {
    setWishroomError('')
    try {
      await client.post('/wishroom/import', {
        roomId: selectedRoomId,
        itemId: item.id,
        groupId: importGroupId ? Number(importGroupId) : null,
      })
      loadAll()
    } catch (err) {
      setWishroomError(err.response?.data?.message || t('Save failed'))
    }
  }

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

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <h2 className="font-semibold mb-3">{t('WishRoom')}</h2>
        {wishroom.connected ? (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="text-sm text-slate-600">
                {t('Connected as')} <strong>{wishroom.name || wishroom.email}</strong>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={openImportPanel} className="text-sm text-brand-600">{t('Import from WishRoom')}</button>
                <button onClick={handleWishroomDisconnect} className="text-sm text-red-600">{t('Disconnect')}</button>
              </div>
            </div>

            {importOpen && (
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <select value={selectedRoomId} onChange={(e) => selectRoom(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md w-full">
                  <option value="">{t('Pick a room')}</option>
                  {wishroomRooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.itemCount})</option>)}
                </select>

                {selectedRoomId && (
                  <>
                    <select value={importGroupId} onChange={(e) => setImportGroupId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md w-full">
                      <option value="">{t('No group (just for me)')}</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <div className="space-y-2">
                      {wishroomItems.length === 0 && <div className="text-sm text-slate-500">{t('No items in this room.')}</div>}
                      {wishroomItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-md px-3 py-2">
                          <span>{item.title}{item.price ? ` · ${money(item.price)}` : ''}</span>
                          <button onClick={() => importWishroomItem(item)} className="text-brand-600">{t('Import')}</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleWishroomConnect} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required type="email" placeholder={t('WishRoom email')} value={wishroomForm.email} onChange={(e) => setWishroomForm({ ...wishroomForm, email: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <input required type="password" placeholder={t('WishRoom password')} value={wishroomForm.password} onChange={(e) => setWishroomForm({ ...wishroomForm, password: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-md" />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-4 py-2 font-medium">{t('Connect WishRoom')}</button>
          </form>
        )}
        {wishroomError && <div className="mt-2 text-sm text-red-600">{wishroomError}</div>}
      </div>

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
