import * as XLSX from 'xlsx-js-style'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function todayDot() {
  const d = new Date()
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`
}

function asText(v) {
  return String(v ?? '').trim()
}

function numOr0(v) {
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function buildDeliveryHuWorkbook(selectedOrders) {
  if (!selectedOrders?.length) throw new Error('Nincs kijelölés.')

  const first = selectedOrders[0]
  const exportId = asText(first.deliveryNote || '2026/001')

  const rows = []

  rows.push(['Delivery Note / Szállítólevél'])
  rows.push([])
  rows.push(['Delivery note No / Bizonylat sorszáma:', '', '', exportId])
  rows.push([])

  rows.push(['From / Feladó:', '', '', '', 'To / Címzett:'])
  rows.push(['Magma Kft', '', '', '', asText(first.customer || '')])
  rows.push(['H-1211 Budapest, Déli u. 13, Hungary'])
  rows.push(['VAT no.: HU10368152'])
  rows.push([])

  rows.push(['Order No.', '', 'Order Date (DMY)', '', 'Payment term', '', 'Delivery date (DMY)'])
  rows.push([asText(first.orderNo || ''), '', asText(first.orderDate || ''), '', 'bank transfer', '', todayDot()])
  rows.push([])

  rows.push(['', 'Item', 'Product description', 'Qty', 'Net weight (kg)', 'No. of box', 'No. of pallets', 'Gross weight (kg)'])

  let totalQty = 0
  let totalNet = 0
  let totalBoxes = 0
  let totalPallets = 0
  let totalGross = 0

  selectedOrders.forEach((r, idx) => {
    const qty = numOr0(r.amountPc)
    const net = numOr0(r.requiredMaterialKg)
    const boxes = numOr0(r.boxesCount)
    const pallets = numOr0(r.palletsCount)
    const gross = numOr0(r.grossWeightKg)

    totalQty += qty
    totalNet += net
    totalBoxes += boxes
    totalPallets += pallets
    totalGross += gross

    rows.push(['', idx + 1, asText(r.designation || r.productName || ''), qty, net, boxes, pallets, gross])
  })

  rows.push(['', '', 'Total', totalQty, totalNet, totalBoxes, totalPallets, totalGross])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 3 },
    { wch: 6 },
    { wch: 38 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Szállító HU')

  return { wb, exportId }
}