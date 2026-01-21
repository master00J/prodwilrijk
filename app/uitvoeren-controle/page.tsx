'use client'

import { useEffect, useMemo, useState } from 'react'

type TemplateItem = {
  id: number
  item_beschrijving: string
  item_type: string
  volgorde: number
  is_verplicht: boolean
  hulptekst: string | null
}

type Template = {
  id: number
  naam: string
  afdeling: string | null
}

type ChecklistEntry = {
  key: string
  template_item_id: number | null
  item_beschrijving: string
  item_type: string
  is_verplicht: boolean
  hulptekst: string | null
  antwoord_waarde: string | null
  opmerking_bij_antwoord: string | null
  isAdhoc: boolean
}

export default function UitvoerenControlePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [checklistItems, setChecklistItems] = useState<ChecklistEntry[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string | null>(null)
  const [photos, setPhotos] = useState<File[]>([])

  const [formData, setFormData] = useState({
    product_naam: '',
    order_nummer: '',
    uitgevoerd_door: '',
    gecontroleerde_persoon: '',
    afdeling: '',
    controle_datum: new Date().toISOString().split('T')[0],
    algemene_opmerkingen: '',
    status: 'in behandeling',
  })

  const [adhocItem, setAdhocItem] = useState({
    item_beschrijving: '',
    item_type: 'ok/niet ok/n.v.t.',
    hulptekst: '',
    is_verplicht: false,
  })

  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos]
  )

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [photoPreviews])

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true)
      try {
        const response = await fetch('/api/checklist-beheer/templates')
        if (!response.ok) throw new Error('Failed to fetch templates')
        const data = await response.json()
        setTemplates(data || [])
      } catch (error) {
        console.error('Error fetching templates:', error)
        setErrors('Kon checklist templates niet laden.')
      } finally {
        setLoadingTemplates(false)
      }
    }
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (!selectedTemplateId) {
      setChecklistItems([])
      return
    }

    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/checklist-beheer/templates/${selectedTemplateId}`)
        if (!response.ok) throw new Error('Failed to fetch template items')
        const data = await response.json()
        const items = (data.items || []).map((item: TemplateItem) => ({
          key: `template-${item.id}`,
          template_item_id: item.id,
          item_beschrijving: item.item_beschrijving,
          item_type: item.item_type || 'ok/niet ok/n.v.t.',
          is_verplicht: Boolean(item.is_verplicht),
          hulptekst: item.hulptekst || null,
          antwoord_waarde: null,
          opmerking_bij_antwoord: null,
          isAdhoc: false,
        }))
        setChecklistItems(items)
      } catch (error) {
        console.error('Error fetching template items:', error)
        setErrors('Kon checklist items niet laden.')
      }
    }
    fetchTemplate()
  }, [selectedTemplateId])

  const handleChecklistChange = (key: string, field: keyof ChecklistEntry, value: string | boolean | null) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    )
  }

  const handleAddAdhocItem = () => {
    if (!adhocItem.item_beschrijving.trim()) {
      setErrors('Beschrijving is verplicht voor een extra checklist item.')
      return
    }
    setErrors(null)
    const newItem: ChecklistEntry = {
      key: `adhoc-${Date.now()}`,
      template_item_id: null,
      item_beschrijving: adhocItem.item_beschrijving.trim(),
      item_type: adhocItem.item_type,
      is_verplicht: adhocItem.is_verplicht,
      hulptekst: adhocItem.hulptekst.trim() || null,
      antwoord_waarde: null,
      opmerking_bij_antwoord: null,
      isAdhoc: true,
    }
    setChecklistItems((prev) => [...prev, newItem])
    setAdhocItem({
      item_beschrijving: '',
      item_type: 'ok/niet ok/n.v.t.',
      hulptekst: '',
      is_verplicht: false,
    })
  }

  const handleRemoveAdhocItem = (key: string) => {
    setChecklistItems((prev) => prev.filter((item) => item.key !== key))
  }

  const handlePhotoChange = (files: FileList | null) => {
    if (!files) return
    const fileArray = Array.from(files)
    setPhotos((prev) => [...prev, ...fileArray].slice(0, 10))
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async () => {
    setErrors(null)
    setMessage(null)

    if (!formData.product_naam || !formData.uitgevoerd_door || !formData.gecontroleerde_persoon) {
      setErrors('Productnaam, uitvoerder en gecontroleerde persoon zijn verplicht.')
      return
    }

    const checklistPayload = checklistItems.map((item) => ({
      template_item_id: item.template_item_id,
      item_beschrijving: item.item_beschrijving,
      antwoord_waarde: item.antwoord_waarde,
      opmerking_bij_antwoord: item.opmerking_bij_antwoord,
    }))

    const payload = new FormData()
    payload.append('product_naam', formData.product_naam)
    payload.append('order_nummer', formData.order_nummer)
    payload.append('uitgevoerd_door', formData.uitgevoerd_door)
    payload.append('gecontroleerde_persoon', formData.gecontroleerde_persoon)
    payload.append('afdeling', formData.afdeling)
    payload.append('algemene_opmerkingen', formData.algemene_opmerkingen)
    payload.append('status', formData.status)
    payload.append('checklist_template_id', selectedTemplateId)
    payload.append('checklist_items', JSON.stringify(checklistPayload))

    photos.forEach((photo) => payload.append('fotos', photo))

    setSaving(true)
    try {
      const response = await fetch('/api/product-inspectie/controles', {
        method: 'POST',
        body: payload,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Fout bij opslaan controle')
      }

      setMessage(`Controle opgeslagen (ID: ${data.controleId}).`)
      setFormData({
        product_naam: '',
        order_nummer: '',
        uitgevoerd_door: '',
        gecontroleerde_persoon: '',
        afdeling: '',
        controle_datum: new Date().toISOString().split('T')[0],
        algemene_opmerkingen: '',
        status: 'in behandeling',
      })
      setChecklistItems([])
      setSelectedTemplateId('')
      setPhotos([])
    } catch (error: any) {
      console.error('Error saving controle:', error)
      setErrors(error.message || 'Fout bij opslaan controle')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Product Controle Uitvoeren</h1>
          <p className="text-gray-600 mt-2">
            Voer een kwaliteitscontrole uit op producten met behulp van checklist templates.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {errors && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {errors}
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {message}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Algemene informatie</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Productnaam / Orderreferentie *</label>
              <input
                type="text"
                value={formData.product_naam}
                onChange={(e) => setFormData({ ...formData, product_naam: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordernummer</label>
              <input
                type="text"
                value={formData.order_nummer}
                onChange={(e) => setFormData({ ...formData, order_nummer: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uitgevoerd door *</label>
              <input
                type="text"
                value={formData.uitgevoerd_door}
                onChange={(e) => setFormData({ ...formData, uitgevoerd_door: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gecontroleerde persoon *</label>
              <input
                type="text"
                value={formData.gecontroleerde_persoon}
                onChange={(e) => setFormData({ ...formData, gecontroleerde_persoon: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Afdeling</label>
              <input
                type="text"
                value={formData.afdeling}
                onChange={(e) => setFormData({ ...formData, afdeling: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum controle</label>
              <input
                type="date"
                value={formData.controle_datum}
                onChange={(e) => setFormData({ ...formData, controle_datum: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Checklist template</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={loadingTemplates}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Selecteer template --</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.naam} {template.afdeling ? `(${template.afdeling})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Checklist items</h2>
          {checklistItems.length === 0 && (
            <div className="text-gray-500 text-sm">Selecteer een template of voeg handmatig items toe.</div>
          )}

          <div className="space-y-4">
            {checklistItems.map((item) => (
              <div key={item.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900">
                      {item.item_beschrijving} {item.is_verplicht && <span className="text-red-500">*</span>}
                    </div>
                    {item.hulptekst && <div className="text-xs text-gray-500 mt-1">{item.hulptekst}</div>}
                  </div>
                  {item.isAdhoc && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdhocItem(item.key)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Verwijderen
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  {item.item_type?.toLowerCase() === 'ja/nee' && (
                    <div className="flex gap-4">
                      {['Ja', 'Nee'].map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={item.key}
                            value={option.toLowerCase()}
                            checked={item.antwoord_waarde === option.toLowerCase()}
                            onChange={(e) => handleChecklistChange(item.key, 'antwoord_waarde', e.target.value)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  )}

                  {(item.item_type?.toLowerCase() === 'ok/niet ok/n.v.t.' ||
                    item.item_type?.toLowerCase() === 'ok/nok') && (
                    <div className="flex gap-4">
                      {['ok', 'niet ok', 'n.v.t.'].map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={item.key}
                            value={option}
                            checked={item.antwoord_waarde === option}
                            onChange={(e) => handleChecklistChange(item.key, 'antwoord_waarde', e.target.value)}
                          />
                          {option.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  )}

                  {item.item_type?.toLowerCase() === 'tekst' && (
                    <textarea
                      value={item.antwoord_waarde || ''}
                      onChange={(e) => handleChecklistChange(item.key, 'antwoord_waarde', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  )}

                  {item.item_type?.toLowerCase() === 'numeriek' && (
                    <input
                      type="number"
                      value={item.antwoord_waarde || ''}
                      onChange={(e) => handleChecklistChange(item.key, 'antwoord_waarde', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 max-w-xs"
                    />
                  )}

                  {item.item_type?.toLowerCase() === 'datum' && (
                    <input
                      type="date"
                      value={item.antwoord_waarde || ''}
                      onChange={(e) => handleChecklistChange(item.key, 'antwoord_waarde', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 max-w-xs"
                    />
                  )}

                  {item.item_type?.toLowerCase() === 'foto' && (
                    <input
                      type="file"
                      onChange={(e) =>
                        handleChecklistChange(item.key, 'antwoord_waarde', e.target.files?.[0]?.name || '')
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  )}
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">Opmerking (optioneel)</label>
                  <textarea
                    value={item.opmerking_bij_antwoord || ''}
                    onChange={(e) => handleChecklistChange(item.key, 'opmerking_bij_antwoord', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Extra checklist item toevoegen</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Beschrijving"
                value={adhocItem.item_beschrijving}
                onChange={(e) => setAdhocItem({ ...adhocItem, item_beschrijving: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2"
              />
              <select
                value={adhocItem.item_type}
                onChange={(e) => setAdhocItem({ ...adhocItem, item_type: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="ok/niet ok/n.v.t.">OK / Niet OK / N.v.t.</option>
                <option value="ja/nee">Ja / Nee</option>
                <option value="tekst">Tekst</option>
                <option value="numeriek">Numeriek</option>
                <option value="datum">Datum</option>
                <option value="foto">Foto</option>
              </select>
              <input
                type="text"
                placeholder="Hulptekst"
                value={adhocItem.hulptekst}
                onChange={(e) => setAdhocItem({ ...adhocItem, hulptekst: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={adhocItem.is_verplicht}
                  onChange={(e) => setAdhocItem({ ...adhocItem, is_verplicht: e.target.checked })}
                />
                Verplicht
              </label>
            </div>
            <button
              type="button"
              onClick={handleAddAdhocItem}
              className="mt-3 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Item toevoegen
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Foto&apos;s</h2>
          <input
            type="file"
            multiple
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoChange(e.target.files)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Je kan rechtstreeks foto&apos;s nemen of bestanden kiezen vanaf je toestel.
          </p>
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {photoPreviews.map((preview, index) => (
                <div key={preview.url} className="relative">
                  <img src={preview.url} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-2 right-2 bg-white/90 text-red-600 rounded-full w-7 h-7 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Opmerkingen & status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Algemene opmerkingen</label>
              <textarea
                value={formData.algemene_opmerkingen}
                onChange={(e) => setFormData({ ...formData, algemene_opmerkingen: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="in behandeling">In behandeling</option>
                <option value="goedgekeurd">Goedgekeurd</option>
                <option value="afgekeurd">Afgekeurd</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Opslaan...' : 'Controle opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
