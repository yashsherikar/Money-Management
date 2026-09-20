import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLanguage } from '../context/LanguageContext.jsx'

function money(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

const emptyForm = { name: '', price: '', productUrl: '' }

export default function Wishlist() {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [affordability, setAffordability] = useState({}) // itemId -> data
  const [requestOpenFor, setRequestOpenFor] = useState(null)
  const [requestRows, setRequestRows] = useState([{ email: '', amount: '' }])
  const [requestError, setRequestError] = useState('')

  const [wishroom, setWishroom] = useState({ connected: false, email: '', name: '' })
  const [wishroomForm, setWishroomForm] = useState({ email: '', password: '' })
  const [wishroomError, setWishroomError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [wishroomRooms, setWishroomRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [wishroomItems, setWishroomItems] = useState([])

  async function loadAll() {
    const [itemsRes, wishroomRes] = await Promise.all([
      client.get('/wishlist'),
      client.get('/wishroom/status'),
    ])
    setItems(itemsRes.data)
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
      await client.post('/wishroom/import', { roomId: selectedRoomId, itemId: item.id })
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

  async function handleMarkPurchased(id) {
    await client.patch(`/wishlist/${id}/purchased`)
    loadAll()
  }

  async function checkAffordability(item) {
    const { data } = await client.get(`/wishlist/${item.id}/affordability`)
    setAffordability((prev) => ({ ...prev, [item.id]: data }))
  }

  function openRequestForm(item) {
    setRequestError('')
    setRequestRows([{ email: '', amount: '' }])
    setRequestOpenFor(item.id)
  }

  function updateRequestRow(index, field, value) {
    setRequestRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addRequestRow() {
    setRequestRows((rows) => [...rows, { email: '', amount: '' }])
  }

  function removeRequestRow(index) {
    setRequestRows((rows) => rows.filter((_, i) => i !== index))
  }

  async function submitRequests(item) {
    setRequestError('')
    const requests = requestRows
      .filter((r) => r.email && r.amount)
      .map((r) => ({ email: r.email.trim(), amount: Number(r.amount) }))
    if (requests.length === 0) return
    try {
      await client.post(`/wishlist/${item.id}/contribution-requests`, { requests })
      setRequestOpenFor(null)
    } catch (err) {
      setRequestError(err.response?.data?.message || t('Save failed'))
    }
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
                  <div className="space-y-2">
                    {wishroomItems.length === 0 && <div className="text-sm text-slate-500">{t('No items in this room.')}</div>}
                    {wishroomItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-md px-3 py-2">
                        <span>{item.title}{item.price ? ` · ${money(item.price)}` : ''}</span>
                        <button onClick={() => importWishroomItem(item)} className="text-brand-600">{t('Import')}</button>
                      </div>
                    ))}
                  </div>
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
                    {money(item.price)} · {t(item.status)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.status !== 'PURCHASED' && (
                    <button onClick={() => handleMarkPurchased(item.id)} className="text-sm text-emerald-600">{t('Mark purchased')}</button>
                  )}
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

                  {Number(a.shortfall) > 0 && (
                    <div className="mt-3">
                      {requestOpenFor === item.id ? (
                        <div className="space-y-2">
                          {requestRows.map((r, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="email" placeholder={t('Their email')}
                                value={r.email} onChange={(e) => updateRequestRow(i, 'email', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded-md flex-1"
                              />
                              <input
                                type="number" step="0.01" min="0.01" placeholder={t('Amount')}
                                value={r.amount} onChange={(e) => updateRequestRow(i, 'amount', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded-md w-28"
                              />
                              {requestRows.length > 1 && (
                                <button onClick={() => removeRequestRow(i)} className="text-red-600 text-sm">{t('Remove')}</button>
                              )}
                            </div>
                          ))}
                          <button onClick={addRequestRow} className="text-sm text-brand-600 block">{t('+ Add another person')}</button>
                          {requestError && <div className="text-sm text-red-600">{requestError}</div>}
                          <div className="flex gap-2">
                            <button onClick={() => submitRequests(item)} className="bg-brand-500 hover:bg-brand-600 text-white rounded-md px-3 py-1.5 text-sm font-medium">{t('Send requests')}</button>
                            <button onClick={() => setRequestOpenFor(null)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-md">{t('Cancel')}</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openRequestForm(item)} className="text-sm text-brand-600">{t('Request the shortfall from someone')}</button>
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
