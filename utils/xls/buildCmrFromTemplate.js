import * as XLSX from 'xlsx-js-style'

function setCell(ws, addr, value) {
  XLSX.utils.sheet_add_aoa(ws, [[value]], { origin: addr })
  if (!ws[addr]) ws[addr] = { t: 's', v: value }
  else ws[addr].v = value
}

export async function buildCmrWorkbook(selectedOrders, consignee = {}) {
  const res = await fetch('/CMR_template.xlsx') // ha a Vite rootból szolgálja ki
  const buf = await res.arrayBuffer()

  const wb = XLSX.read(buf, { type: 'array', cellStyles: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  const first = selectedOrders?.[0] || {}
  const exportId = String(first.deliveryNote || '2026/001')

  setCell(ws, 'B6', consignee.name ?? first.customer ?? '')
  setCell(ws, 'B7', consignee.address ?? '')
  setCell(ws, 'B12', consignee.city ?? '')
  setCell(ws, 'B13', consignee.country ?? '')

  // ... dátum + táblázat ugyanúgy ...

  return { wb, exportId }
}