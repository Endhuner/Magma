import * as XLSX from 'xlsx-js-style'
import { CMR_TEMPLATE_AOA } from './cmrTemplate.js'

function asText(v) {
  return String(v ?? '').trim()
}

function numOrNull(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(',', '.').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function getCellString(ws, addr) {
  const cell = ws?.[addr]
  if (!cell) return ''
  // A template-ből jövő cellák tipikusan stringek; ha más típus, akkor is legyen olvasható
  if (cell.v == null) return ''
  return String(cell.v)
}

function setCell(ws, addr, value) {
  XLSX.utils.sheet_add_aoa(ws, [[value]], { origin: addr })
}

function appendCell(ws, addr, value, { prefix = '', newline = '\n' } = {}) {
  const add = asText(value)
  if (!add) return

  const current = getCellString(ws, addr)
  const next =
    current && current.trim()
      ? `${current}${newline}${prefix}${add}`
      : `${prefix}${add}`

  // Írjuk vissza ugyanoda
  setCell(ws, addr, next)

  // Wrap kötelező, különben egy sorba nyújtja
  if (!ws[addr]) ws[addr] = { t: 's', v: next }
  ws[addr].s = ws[addr].s || {}
  ws[addr].s.alignment = { ...(ws[addr].s.alignment || {}), wrapText: true, vertical: 'top' }
}

function setCellStyle(ws, addr, style) {
  if (!ws[addr]) ws[addr] = { t: 's', v: '' }
  ws[addr].s = { ...(ws[addr].s || {}), ...(style || {}) }
}

function thinBorder() {
  return {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }
}

function applyBorderRange(ws, r1, c1, r2, c2) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })
      if (!ws[addr]) ws[addr] = { t: 's', v: '' }
      ws[addr].s = ws[addr].s || {}
      ws[addr].s.border = thinBorder()
      ws[addr].s.alignment = { ...(ws[addr].s.alignment || {}), vertical: 'top', wrapText: true }
      ws[addr].s.font = ws[addr].s.font || { name: 'Arial', sz: 10 }
    }
  }
}

function applyWrapAndFontAll(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) continue
      ws[addr].s = ws[addr].s || {}
      ws[addr].s.alignment = { ...(ws[addr].s.alignment || {}), wrapText: true, vertical: 'top' }
      ws[addr].s.font = ws[addr].s.font || { name: 'Arial', sz: 10 }
    }
  }
}

function todayParts() {
  const d = new Date()
  return {
    day: String(d.getDate()),
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  }
}

/**
 * Mapping (a kérésed alapján), úgy hogy NEM írjuk felül a template szöveget:
 * - B6/B7/B12/B13: hozzáfűzzük az adatot a meglévő cella szöveghez
 * - A16..: táblázat sorok (ott általában üres, oda simán írunk)
 * - C26/E26/F26: dátum (általában üres)
 */
export function buildCmrWorkbook(selectedOrders, consignee = {}) {
  if (!selectedOrders?.length) throw new Error('Nincs kijelölés.')

  const first = selectedOrders[0]
  const exportId = asText(first.deliveryNote || '2026/001')

  const ws = XLSX.utils.aoa_to_sheet(CMR_TEMPLATE_AOA)

  ws['!cols'] = [
    { wch: 34 }, // A
    { wch: 28 }, // B
    { wch: 24 }, // C
    { wch: 3 },  // D
    { wch: 3 },  // E
    { wch: 44 }, // F
    { wch: 18 }, // G
    { wch: 4 },  // H
    { wch: 18 }, // I
    { wch: 4 },  // J
    { wch: 22 }, // K
  ]

  applyWrapAndFontAll(ws)

  // Vevő mezők: APPEND (nem felülírás)
  appendCell(ws, 'B6', asText(consignee.name ?? first.customer ?? ''), { prefix: '' })
  appendCell(ws, 'B7', asText(consignee.address ?? ''), { prefix: '' })
  appendCell(ws, 'B12', asText(consignee.city ?? ''), { prefix: '' })
  appendCell(ws, 'B13', asText(consignee.country ?? ''), { prefix: '' })

  ;['B6', 'B7', 'B12', 'B13'].forEach(addr => {
    setCellStyle(ws, addr, {
      font: { name: 'Arial', sz: 10 },
      alignment: { wrapText: true, vertical: 'top' },
    })
  })

  // Dátum: ezeket általában üresen hagyja a template, ide mehet sima set
  const t = todayParts()
  setCell(ws, 'C26', t.day)
  setCell(ws, 'E26', t.month)
  setCell(ws, 'F26', t.year)

  // Rendelések: A16.. lefelé (ott jellemzően üres, oda mehet simán set)
  selectedOrders.forEach((r, i) => {
    const row = 16 + i

    const pallets = numOrNull(r.palletsCount)
    const boxes = numOrNull(r.boxesCount)

    setCell(ws, `A${row}`, asText(r.orderNo ?? ''))
    setCell(ws, `B${row}`, pallets == null ? '' : `${pallets} Palette`)
    setCell(ws, `C${row}`, boxes == null ? '' : `${boxes} Box`)
    setCell(ws, `F${row}`, asText(r.designation || r.productName || ''))
    setCell(ws, `I${row}`, asText(r.grossWeightKg ?? ''))
  })

  const maxRow = 16 + selectedOrders.length - 1
  if (maxRow >= 16) applyBorderRange(ws, 16, 1, maxRow, 9) // A..I

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CMR')

  return { wb, exportId }
}