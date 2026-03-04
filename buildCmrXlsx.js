import * as XLSX from 'xlsx'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function asText(v) {
  return String(v ?? '').trim()
}

function uniq(arr) {
  const out = []
  const seen = new Set()
  for (const x of arr) {
    const s = asText(x)
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/**
 * CMR sheet (egyszerű):
 * - G: unique note
 * - P: soronként ownOrderNo
 * - O: unique designation/product
 * - F: unique material
 * - Q: unique grossWeightKg
 *
 * A feliratok egyszerűek; ha van konkrét “fix” szöveglistád,
 * írd meg és 1:1 átírom.
 */
export function buildCmrWorkbook(selectedOrders) {
  if (!selectedOrders?.length) throw new Error('Nincs kijelölés.')

  const first = selectedOrders[0]
  const exportId = asText(first.deliveryNote || '2026/001')

  const d = new Date()
  const dd = pad2(d.getDate())
  const mm = pad2(d.getMonth() + 1)
  const yyyy = String(d.getFullYear())

  const gList = uniq(selectedOrders.map(r => r.note))
  const pRows = selectedOrders.map(r => asText(r.ownOrderNo)).filter(Boolean)
  const oList = uniq(selectedOrders.map(r => r.designation || r.productName))
  const fList = uniq(selectedOrders.map(r => r.material))
  const qList = uniq(selectedOrders.map(r => r.grossWeightKg))

  const rows = []
  rows.push(['CMR', `CMR_${exportId}`])
  rows.push(['Customer', asText(first.customer || '')])
  rows.push(['Date (DD/MM/YYYY)', `${dd}/${mm}/${yyyy}`])
  rows.push([])

  rows.push(['G unique (note)', 'P rows (ownOrderNo)', 'O unique (product)', 'F unique (material)', 'Q unique (gross)'])

  const maxLen = Math.max(
    gList.length || 1,
    pRows.length || 1,
    oList.length || 1,
    fList.length || 1,
    qList.length || 1
  )

  for (let i = 0; i < maxLen; i++) {
    rows.push([gList[i] ?? '', pRows[i] ?? '', oList[i] ?? '', fList[i] ?? '', qList[i] ?? ''])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 18 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CMR')

  return { wb, exportId }
}