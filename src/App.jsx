import { useState, useRef, useEffect } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
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

function App() {
  const [items, setItems] = useState([
    { id: 1, item: '', description: '', amount: 0, quantity: 1 },
  ])
  const [ivaPercent, setIvaPercent] = useState(19)
  const [quoteName, setQuoteName] = useState('')
  const [quoteDate, setQuoteDate] = useState(() => formatDateForInput(new Date()))
  const [validityDate, setValidityDate] = useState('')
  const pdfRef = useRef(null)

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        item: '',
        description: '',
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
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              [field]:
                field === 'amount' || field === 'quantity'
                  ? parseFloat(value) || 0
                  : value,
            }
          : i
      )
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
            amount: 0,
            quantity: 1,
          },
        ])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const subtotal = items.reduce((sum, item) => sum + getSubtotal(item), 0)
  const ivaAmount = subtotal * (ivaPercent / 100)
  const total = subtotal + ivaAmount

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

  return (
    <div className="app">
      <header className="header">
        <h1>Cotizador</h1>
        <p className="subtitle">Crea cotizaciones rápidas y descárgalas en PDF</p>
      </header>

      <main className="main">
        <section className="editor-section">
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
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
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
                        type="text"
                        placeholder="Opcional"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, 'description', e.target.value)
                        }
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
                    <td>
                      <button
                        className="btn btn-icon btn-danger"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                onChange={(e) => setIvaPercent(parseFloat(e.target.value) || 0)}
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
              <h1 className="pdf-title">{quoteName || 'Cotización'}</h1>
              <div className="pdf-meta">
                <span>{formatDateForDisplay(quoteDate)}</span>
                {validityDate && (
                  <span className="pdf-validity">
                    Cotización válida hasta {formatDateForDisplay(validityDate)}
                  </span>
                )}
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
                      <td>{item.description || '—'}</td>
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
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
