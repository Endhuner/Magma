import * as XLSX from 'xlsx-js-style'
import sheetHtml from '../../assets/cmr/sheet001.htm?raw'
import sheetCss from '../../assets/cmr/stylesheet.css?raw'
import { htmlAndCssToWorksheet, worksheetToWorkbook } from './cmr/htmlCmrTemplateToSheet.js'
import { applyMergeBorder } from './cmr/applyMergeBorders.js'

function asText(v) {
  return String(v ?? '').trim()
}

function numOrNull(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(',', '.').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function setCell(ws, addr, value) {
  XLSX.utils.sheet_add_aoa(ws, [[value]], { origin: addr })
  if (!ws[addr]) ws[addr] = { t: 's', v: value }
}

function appendCell(ws, addr, value, { newline = '\n' } = {}) {
  const add = asText(value)
  if (!add) return

  const cur = ws[addr]?.v ? String(ws[addr].v) : ''
  const next = cur && cur.trim() ? `${cur}${newline}${add}` : add

  setCell(ws, addr, next)

  ws[addr].s = ws[addr].s || {}
  ws[addr].s.alignment = { ...(ws[addr].s.alignment || {}), wrapText: true, vertical: 'top' }
}

function todayParts() {
  const d = new Date()
  return {
    day: String(d.getDate()),
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  }
}

function mergeStartCellFor(addr, merges) {
  const { r, c } = XLSX.utils.decode_cell(addr)
  const m = merges?.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c)
  if (!m) return addr
  return XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })
}

export async function buildCmrWorkbook(selectedOrders, consignee = {}) {
  if (!selectedOrders?.length) throw new Error('Nincs kijelölés.')

  const first = selectedOrders[0]
  const exportId = asText(first.deliveryNote || '2026/001')

  const ws = htmlAndCssToWorksheet(sheetHtml, sheetCss)

  // Ha azt akarod, hogy CSAK ott legyen keret, ahol a HTML-ben van,
  // akkor ezt a részt érdemes KIKAPCSOLNI, mert plusz kereteket rajzol.
  for (const m of ws['!merges'] || []) {
    applyMergeBorder(ws, m, { top: true, right: true, bottom: true, left: true })
  }

  const merges = ws['!merges'] || []

  appendCell(ws, mergeStartCellFor('B6', merges), asText(consignee.name ?? first.customer ?? ''))
  appendCell(ws, mergeStartCellFor('B7', merges), asText(consignee.address ?? ''))
  appendCell(ws, mergeStartCellFor('B12', merges), asText(consignee.city ?? ''))
  appendCell(ws, mergeStartCellFor('B13', merges), asText(consignee.country ?? ''))

  const t = todayParts()
  setCell(ws, mergeStartCellFor('C26', merges), t.day)
  setCell(ws, mergeStartCellFor('E26', merges), t.month)
  setCell(ws, mergeStartCellFor('F26', merges), t.year)

  ws['!margins'] = { ...(ws['!margins'] || {}), left: 0.4, right: 0.4 }

  // ✅ OSZLOPSZÉLESSÉG FIX: itt tényleg nem kell meghagyni a többit.
  // Ha a layout 11 oszlop (A–K), akkor állítsuk pontosan ennyire:
  const colWidthsPx = [117, 117, 36, 36, 47, 85, 44, 41, 41, 43, 86]
  ws['!cols'] = colWidthsPx.map((wpx) => ({ wpx }))

  selectedOrders.forEach((r, i) => {
    const row = 16 + i
    const pallets = numOrNull(r.palletsCount)
    const boxes = numOrNull(r.boxesCount)

    setCell(ws, mergeStartCellFor(`A${row}`, merges), asText(r.orderNo ?? ''))
    setCell(ws, mergeStartCellFor(`B${row}`, merges), pallets == null ? '' : `${pallets} Palette`)
    setCell(ws, mergeStartCellFor(`C${row}`, merges), boxes == null ? '' : `${boxes} Box`)
    setCell(ws, mergeStartCellFor(`F${row}`, merges), asText(r.designation || r.productName || ''))
    setCell(ws, mergeStartCellFor(`I${row}`, merges), asText(r.grossWeightKg ?? ''))
  })

  const wb = worksheetToWorkbook(ws, 'CMR')
  return { wb, exportId }
}