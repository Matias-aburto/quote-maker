import { useState, useRef, useEffect, Fragment } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { supabase } from './supabaseClient'
import RichTextEditor from './RichTextEditor'
import Auth from './Auth'
import './App.css'

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

const formatDateForInput = (date) => {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const APP_VERSION = 'v0.2.3'

function App() {
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [appError, setAppError] = useState('')
  const [company, setCompany] = useState({
    name: '',
    taxId: '',
    address: '',
    email: '',
    phone: '',
    website: '',
    logoUrl: '',
  })
  const [clientInfo, setClientInfo] = useState({
    name: '',
    company: '',
    taxId: '',
    email: '',
  })
  const [companyStatus, setCompanyStatus] = useState({ type: '', message: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [items, setItems] = useState([
    { id: 1, item: '', description: '', hasDescription: false, amount: 0, quantity: 1 },
  ])
  const [ivaPercent, setIvaPercent] = useState(19)
  const [quoteName, setQuoteName] = useState('')
  const [quoteDate, setQuoteDate] = useState(() => formatDateForInput(new Date()))
  const [validityDate, setValidityDate] = useState('')
  const [showCompanyDetails, setShowCompanyDetails] = useState(false)
  const [showClientDetails, setShowClientDetails] = useState(false)
  const pdfRef = useRef(null)

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        item: '',
        description: '',
        hasDescription: false,
        amount: 0,
        quantity: 1,
      },
    ])
  }

  const removeItem = (id) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i

        if (field === 'amount' || field === 'quantity') {
          // Permitimos cadena vacía mientras el usuario edita
          if (value === '') {
            return {
              ...i,
              [field]: '',
            }
          }

          const parsed = parseFloat(String(value).replace(',', '.'))
          let num = Number.isNaN(parsed) ? (field === 'quantity' ? 1 : 0) : parsed

          if (field === 'amount') {
            num = Math.max(0, num)
          } else {
            // quantity
            num = Math.max(1, Math.round(num))
          }

          return {
            ...i,
            [field]: num,
          }
        }

        if (field === 'hasDescription') {
          return {
            ...i,
            hasDescription: Boolean(value),
          }
        }

        return {
          ...i,
          [field]: value,
        }
      })
    )
  }

  const getSubtotal = (item) => {
    return (item.amount || 0) * (item.quantity || 0)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        setItems((prev) => [
          ...prev,
          {
            id: Date.now(),
            item: '',
            description: '',
            hasDescription: false,
            amount: 0,
            quantity: 1,
          },
        ])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!companyStatus.message) return
    const timeout = setTimeout(() => {
      setCompanyStatus({ type: '', message: '' })
    }, 3000)
    return () => clearTimeout(timeout)
  }, [companyStatus.message])

  useEffect(() => {
    if (!showAuth || user) {
      document.body.style.overflow = ''
      return
    }

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowAuth(false)
      }
    }

    window.addEventListener('keydown', handleEsc)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = previousOverflow
    }
  }, [showAuth, user])

  const subtotal = items.reduce((sum, item) => sum + getSubtotal(item), 0)
  const ivaAmount = subtotal * (ivaPercent / 100)
  const total = subtotal + ivaAmount

  const tallyFormId = import.meta.env.VITE_TALLY_FORM_ID

  const openFeedback = () => {
    if (!tallyFormId) return
    if (typeof window !== 'undefined' && window.Tally) {
      window.Tally.openPopup(tallyFormId, { layout: 'modal' })
    }
  }

  const handleCompanyChange = (field, value) => {
    setCompany((prev) => ({ ...prev, [field]: value }))
  }

  const handleClientChange = (field, value) => {
    setClientInfo((prev) => ({ ...prev, [field]: value }))
  }

  const saveCompanyProfile = async () => {
    if (!user) return
    setCompanyStatus({ type: 'info', message: 'Guardando…' })
    const payload = {
      id: user.id,
      company_name: company.name || null,
      tax_id: company.taxId || null,
      address: company.address || null,
      email: company.email || null,
      phone: company.phone || null,
      website: company.website || null,
      logo_url: company.logoUrl || null,
    }
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (error) {
      setCompanyStatus({
        type: 'error',
        message: 'No se pudo guardar los datos de empresa.',
      })
    } else {
      setCompanyStatus({
        type: 'success',
        message: 'Datos de empresa guardados.',
      })
    }
  }

  const handleLogoUpload = async (event) => {
    if (!user) return
    const file = event.target.files?.[0]
    if (!file) return

    setCompanyStatus({ type: 'info', message: 'Subiendo logo…' })

    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/logo.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, file, { upsert: true })
    if (uploadError) {
      console.error(uploadError)
      setCompanyStatus({
        type: 'error',
        message: 'No se pudo subir el logo. Revisa el formato o inténtalo de nuevo.',
      })
      return
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(filePath)
    if (data?.publicUrl) {
      setCompany((prev) => ({ ...prev, logoUrl: data.publicUrl }))
      await saveCompanyProfile()
      setCompanyStatus({
        type: 'success',
        message: 'Logo actualizado correctamente.',
      })
    }
  }

  const handleExportPDF = async () => {
    if (!pdfRef.current) return

    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight) * 0.95
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 10

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      const filename = (quoteName || 'cotizacion')
        .replace(/[^a-z0-9áéíóúñ\s\-_.]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'cotizacion'
      pdf.save(`${filename}.pdf`)
    } catch (err) {
      console.error('Error al generar PDF:', err)
    }
  }

  useEffect(() => {
    const loadProfile = async (userId) => {
      if (!userId) return
      setProfileLoading(true)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_name, tax_id, address, email, phone, website, logo_url')
          .eq('id', userId)
          .maybeSingle()
        if (profile) {
          setCompany({
            name: profile.company_name || '',
            taxId: profile.tax_id || '',
            address: profile.address || '',
            email: profile.email || '',
            phone: profile.phone || '',
            website: profile.website || '',
            logoUrl: profile.logo_url || '',
          })
        }
      } finally {
        setProfileLoading(false)
      }
    }
    const init = async () => {
      const hasSupabaseConfig =
        Boolean(import.meta.env.VITE_SUPABASE_URL) &&
        Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)

      if (!hasSupabaseConfig) {
        setAppError(
          'Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en producción.',
        )
        return
      }

      // Config correcto: limpiamos cualquier error global previo
      setAppError('')

      try {
        const { data, error } = await supabase.auth.getUser()
        // Errores típicos como "Auth session missing" al no tener sesión no deben romper la app
        if (error && !/auth session/i.test(error.message || '')) {
          console.error('Error al obtener el usuario actual:', error)
          return
        }
        if (data?.user) {
          setUser(data.user)
          setProfileLoading(true)
          await loadProfile(data.user.id)
        }
      } catch (err) {
        // Errores de red u otros imprevistos: logueamos pero no mostramos banner bloqueante
        console.error('Error inesperado al inicializar la sesión:', err)
      }
    }
    init()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (!nextUser) {
        setCompany({
          name: '',
          taxId: '',
          address: '',
          email: '',
          phone: '',
          website: '',
          logoUrl: '',
        })
        setClientInfo({ name: '', company: '', taxId: '', email: '' })
        setQuoteName('')
        setQuoteDate(formatDateForInput(new Date()))
        setValidityDate('')
        setItems([{ id: 1, item: '', description: '', hasDescription: false, amount: 0, quantity: 1 }])
        setIvaPercent(19)
        setCompanyStatus({ type: '', message: '' })
      } else {
        setProfileLoading(true)
        loadProfile(nextUser.id)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="app">
      {appError && (
        <div className="app-error-banner" role="alert" aria-live="polite">
          <span>{appError}</span>
        </div>
      )}
      <header className="header">
        <div>
          <h1>Cotizador</h1>
          <p className="subtitle">Crea cotizaciones rápidas y descárgalas en PDF</p>
        </div>
        <div className="header-actions">
          {user && (
            <span className="header-user">
              {user.email}
            </span>
          )}
          {user ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await supabase.auth.signOut()
                setUser(null)
              }}
            >
              Cerrar sesión
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAuth(true)}
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <section className="editor-section">
          {user ? (
            <div className="collapsible-section">
              <button
                type="button"
                className="collapsible-header"
                onClick={() => setShowCompanyDetails((v) => !v)}
                aria-expanded={showCompanyDetails}
              >
                <div className="collapsible-header-main">
                  <div className="collapsible-title-row">
                    <span className="collapsible-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="7" width="7" height="14" rx="1" />
                        <rect x="14" y="3" width="7" height="18" rx="1" />
                        <path d="M6 11h1M6 15h1M17 7h1M17 11h1M17 15h1" />
                      </svg>
                    </span>
                    <span className="collapsible-title">Datos de tu empresa</span>
                  </div>
                  <span className="collapsible-summary">
                    {company.name || 'Sin datos guardados aún'}
                  </span>
                </div>
                <span className={`collapsible-chevron${showCompanyDetails ? ' open' : ''}`}>
                  <svg viewBox="0 0 24 24">
                    <path d="M8 10l4 4 4-4" />
                  </svg>
                </span>
              </button>
              {showCompanyDetails &&
                (profileLoading ? (
                  <div className="company-card company-skeleton">
                    <div className="company-card-header">
                      <div>
                        <div className="skeleton skeleton-title" />
                        <div className="skeleton skeleton-subtitle" />
                      </div>
                    </div>
                    <div className="company-grid">
                      <div className="company-logo-block">
                        <div className="skeleton skeleton-logo" />
                        <div className="skeleton skeleton-btn" />
                      </div>
                      <div className="company-fields">
                        <div className="meta-row">
                          <div className="skeleton skeleton-input" />
                          <div className="skeleton skeleton-input" />
                        </div>
                        <div className="meta-row">
                          <div className="skeleton skeleton-input skeleton-full" />
                        </div>
                        <div className="meta-row">
                          <div className="skeleton skeleton-input" />
                          <div className="skeleton skeleton-input" />
                        </div>
                        <div className="meta-row">
                          <div className="skeleton skeleton-input skeleton-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="company-card">
                    <div className="company-card-header">
                      <div>
                        <h2>Datos de tu empresa</h2>
                        <p>Se usarán en la cabecera de la cotización.</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={saveCompanyProfile}
                      >
                        Guardar
                      </button>
                    </div>
                    <div className="company-grid">
                      <div className="company-logo-block">
                        {company.logoUrl ? (
                          <img
                            src={company.logoUrl}
                            alt="Logo empresa"
                            className="company-logo"
                          />
                        ) : (
                          <div className="company-logo placeholder">Logo</div>
                        )}
                        <label className="btn btn-secondary btn-sm logo-upload">
                          Subir logo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                          />
                        </label>
                      </div>
                      <div className="company-fields">
                        <div className="meta-row">
                          <div className="meta-field">
                            <label>Nombre empresa</label>
                            <input
                              type="text"
                              value={company.name}
                              onChange={(e) => handleCompanyChange('name', e.target.value)}
                            />
                          </div>
                          <div className="meta-field">
                            <label>RUT / ID</label>
                            <input
                              type="text"
                              value={company.taxId}
                              onChange={(e) => handleCompanyChange('taxId', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="meta-row">
                          <div className="meta-field">
                            <label>Dirección</label>
                            <input
                              type="text"
                              value={company.address}
                              onChange={(e) => handleCompanyChange('address', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="meta-row">
                          <div className="meta-field">
                            <label>Email</label>
                            <input
                              type="email"
                              value={company.email}
                              onChange={(e) => handleCompanyChange('email', e.target.value)}
                            />
                          </div>
                          <div className="meta-field">
                            <label>Teléfono</label>
                            <input
                              type="text"
                              value={company.phone}
                              onChange={(e) => handleCompanyChange('phone', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="meta-row">
                          <div className="meta-field">
                            <label>Sitio web</label>
                            <input
                              type="text"
                              value={company.website}
                              onChange={(e) => handleCompanyChange('website', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="hint-cta">
              <div className="hint-cta-inner">
                <div className="hint-cta-header">
                  <div className="hint-cta-title">
                    <svg
                      className="hint-cta-lock"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Datos de tu empresa</span>
                  </div>
                  <div className="hint-cta-message">
                    Inicia sesión para guardar el logo y los datos de tu empresa
                  </div>
                </div>
                <div className="hint-cta-placeholders">
                  <div className="hint-cta-placeholder-block">
                    <div className="hint-cta-placeholder-logo">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 21V9" />
                      </svg>
                      Logo
                    </div>
                  </div>
                  <div className="hint-cta-placeholder-fields">
                    <div className="hint-cta-placeholder-row">
                      <div className="hint-cta-placeholder-input" />
                      <div className="hint-cta-placeholder-input" />
                    </div>
                    <div className="hint-cta-placeholder-row">
                      <div className="hint-cta-placeholder-input hint-cta-placeholder-full" />
                    </div>
                    <div className="hint-cta-placeholder-row">
                      <div className="hint-cta-placeholder-input" />
                      <div className="hint-cta-placeholder-input" />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-accent hint-cta-btn"
                  onClick={() => setShowAuth(true)}
                >
                  Iniciar sesión para desbloquear
                </button>
              </div>
            </div>
          )}

          {user && (
            <div className="client-block">
              <button
                type="button"
                className="collapsible-header client-header"
                onClick={() => setShowClientDetails((v) => !v)}
                aria-expanded={showClientDetails}
              >
                <div className="collapsible-header-main">
                  <div className="collapsible-title-row">
                    <span className="collapsible-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="8" r="3.5" />
                        <path d="M5 19c0-3 3-5 7-5s7 2 7 5" />
                      </svg>
                    </span>
                    <span className="collapsible-title">Datos del cliente</span>
                  </div>
                  <span className="collapsible-summary">
                    {clientInfo.name || clientInfo.company || 'Opcional'}
                  </span>
                </div>
                <span className={`collapsible-chevron${showClientDetails ? ' open' : ''}`}>
                  <svg viewBox="0 0 24 24">
                    <path d="M8 10l4 4 4-4" />
                  </svg>
                </span>
              </button>
              {showClientDetails && (
                <>
                  <div className="meta-row">
                    <div className="meta-field">
                      <label>Nombre</label>
                      <input
                        type="text"
                        value={clientInfo.name}
                        onChange={(e) => handleClientChange('name', e.target.value)}
                      />
                    </div>
                    <div className="meta-field">
                      <label>Empresa</label>
                      <input
                        type="text"
                        value={clientInfo.company}
                        onChange={(e) => handleClientChange('company', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="meta-row">
                    <div className="meta-field">
                      <label>RUT / ID</label>
                      <input
                        type="text"
                        value={clientInfo.taxId}
                        onChange={(e) => handleClientChange('taxId', e.target.value)}
                      />
                    </div>
                    <div className="meta-field">
                      <label>Email</label>
                      <input
                        type="email"
                        value={clientInfo.email}
                        onChange={(e) => handleClientChange('email', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="quote-meta">
            <div className="meta-field">
              <label htmlFor="quote-name">Nombre</label>
              <input
                id="quote-name"
                type="text"
                placeholder="Ej: Cotización proyecto X"
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
              />
            </div>
            <div className="meta-row">
              <div className="meta-field">
                <label htmlFor="quote-date">Fecha</label>
                <input
                  id="quote-date"
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
              </div>
              <div className="meta-field">
                <label htmlFor="validity-date">Válida hasta (opcional)</label>
                <input
                  id="validity-date"
                  type="date"
                  value={validityDate}
                  onChange={(e) => setValidityDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="section-header">
            <h2>Items</h2>
            <button className="btn btn-primary" onClick={addItem} title="Shift+Enter">
              + Añadir item
            </button>
          </div>

          <div className="table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Monto</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th className="th-desc">Descripción</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td>
                        <input
                          type="text"
                          placeholder="Nombre del item"
                          value={item.item}
                          onChange={(e) => updateItem(item.id, 'item', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={item.amount || ''}
                          onChange={(e) =>
                            updateItem(item.id, 'amount', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={item.quantity || ''}
                          onChange={(e) =>
                            updateItem(item.id, 'quantity', e.target.value)
                          }
                        />
                      </td>
                      <td className="subtotal-cell">
                        {formatCurrency(getSubtotal(item))}
                      </td>
                      <td className="desc-check-cell">
                        <input
                          type="checkbox"
                          checked={item.hasDescription || false}
                          onChange={(e) =>
                            updateItem(item.id, 'hasDescription', e.target.checked)
                          }
                          title="Incluir descripción"
                          aria-label="Incluir descripción del item"
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                          title="Eliminar item"
                          aria-label="Eliminar item"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                    {item.hasDescription && (
                      <tr className="desc-row">
                        <td colSpan={6}>
                          <RichTextEditor
                            value={item.description}
                            onChange={(html) => updateItem(item.id, 'description', html)}
                            placeholder="Listados, negrita, cursiva..."
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {subtotal === 0 && (
            <p className="items-hint">
              Añade montos y cantidades para ver el resumen y la vista previa de la cotización.
            </p>
          )}

          <div className="totals-section">
            <div className="iva-input-row">
              <label htmlFor="iva">IVA (%)</label>
              <input
                id="iva"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={ivaPercent}
                onChange={(e) => {
                  const raw = e.target.value.replace(',', '.')
                  const parsed = parseFloat(raw)
                  if (Number.isNaN(parsed)) {
                    setIvaPercent(0)
                    return
                  }
                  const clamped = Math.min(100, Math.max(0, parsed))
                  setIvaPercent(clamped)
                }}
              />
            </div>
            <div className="total-row">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="total-row">
              <span>IVA ({ivaPercent}%)</span>
              <span>{formatCurrency(ivaAmount)}</span>
            </div>
            <div className="total-row total-final">
              <span>Total</span>
              <span className="total-amount">{formatCurrency(total)}</span>
            </div>
          </div>
        </section>

        <section className="preview-section">
          <div className="preview-header">
            <h2>Vista previa</h2>
            <button className="btn btn-accent" onClick={handleExportPDF}>
              Descargar PDF
            </button>
          </div>

          <div className="pdf-preview" ref={pdfRef}>
            <div className="pdf-content">
              <div
                className={`pdf-header-row ${
                  !company.logoUrl &&
                  !company.name &&
                  !company.address &&
                  !company.email &&
                  !company.phone &&
                  !company.website
                    ? 'pdf-header-row--no-company'
                    : ''
                }`}
              >
                {(company.logoUrl ||
                  company.name ||
                  company.address ||
                  company.email ||
                  company.phone ||
                  company.website) && (
                  <div className="pdf-company">
                    {company.logoUrl && (
                      <img
                        src={company.logoUrl}
                        alt="Logo empresa"
                        className="pdf-company-logo"
                      />
                    )}
                    {(company.name ||
                      company.address ||
                      company.email ||
                      company.phone ||
                      company.website) && (
                      <div className="pdf-company-text">
                        {company.name && <div className="pdf-company-name">{company.name}</div>}
                        {company.taxId && <div className="pdf-company-line">RUT / ID: {company.taxId}</div>}
                        {company.address && <div className="pdf-company-line">{company.address}</div>}
                        {(company.email || company.phone) && (
                          <div className="pdf-company-line">
                            {company.email}
                            {company.email && company.phone && ' · '}
                            {company.phone}
                          </div>
                        )}
                        {company.website && (
                          <div className="pdf-company-line">{company.website}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="pdf-meta-block">
                  <h1 className="pdf-title">{quoteName || 'Cotización'}</h1>
                  <div className="pdf-meta">
                    <span>{formatDateForDisplay(quoteDate)}</span>
                    {validityDate && (
                      <span className="pdf-validity">
                        Cotización válida hasta {formatDateForDisplay(validityDate)}
                      </span>
                    )}
                  </div>
                  {user && (clientInfo.name || clientInfo.company || clientInfo.email) && (
                    <div className="pdf-client">
                      <div className="pdf-client-label">Para:</div>
                      {clientInfo.name && <div className="pdf-client-line">{clientInfo.name}</div>}
                      {clientInfo.company && (
                        <div className="pdf-client-line">{clientInfo.company}</div>
                      )}
                      {clientInfo.taxId && (
                        <div className="pdf-client-line">RUT / ID: {clientInfo.taxId}</div>
                      )}
                      {clientInfo.email && (
                        <div className="pdf-client-line">{clientInfo.email}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Cant.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item || '—'}</td>
                      <td className="pdf-desc-cell">
                        {item.hasDescription && item.description ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: item.description }}
                            className="pdf-desc-content"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(getSubtotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pdf-totals">
                <div className="pdf-total-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="pdf-total-row">
                  <span>IVA ({ivaPercent}%):</span>
                  <span>{formatCurrency(ivaAmount)}</span>
                </div>
                <div className="pdf-total-row pdf-total-final">
                  <strong>Total:</strong>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                {subtotal === 0 && (
                  <p className="pdf-empty-hint">
                    Añade al menos un item con monto para generar una cotización con totales.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <span>Quote Maker</span>
        <span className="footer-divider">·</span>
        <span>{APP_VERSION}</span>
      </footer>
      {companyStatus.message && (
        <div
          className={`toast toast-${companyStatus.type || 'info'}`}
          role="status"
          aria-live="polite"
        >
          {companyStatus.message}
        </div>
      )}
      {showAuth && !user && (
        <div className="auth-overlay">
          <div className="auth-overlay-backdrop" onClick={() => setShowAuth(false)} />
          <div className="auth-overlay-panel">
            <Auth
              onAuthenticated={(u) => {
                setUser(u)
                setShowAuth(false)
              }}
            />
          </div>
        </div>
      )}
      {tallyFormId && (
        <button
          type="button"
          className="feedback-fab"
          onClick={openFeedback}
          aria-label="Enviar feedback o reportar bug"
        >
          ?
        </button>
      )}
    </div>
  )
}

export default App
