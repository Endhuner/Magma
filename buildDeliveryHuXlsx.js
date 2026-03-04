import * as XLSX from 'xlsx'

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
  // engedjük a "12,34" alakot is
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Selected rowsból készít "Szállító HU" sheetet.
 * A szövegek az általad kért mintából vannak:
 * - Delivery Note / Szállítólevél
 * - Delivery note No / Bizonylat sorszáma:
 * - From / Feladó: (Magma Kft...)
 * - To / Címzett:
 * - Order No. / Order Date / Payment term / Delivery date
 * - Táblázat fejlécek + Total
 */
export function buildDeliveryHuWorkbook(selectedOrders) {
  if (!selectedOrders?.length) throw new Error('Nincs kijelölés.')

  const first = selectedOrders[0]
  const exportId = asText(first.deliveryNote || '2026/001')

  // Array-of-arrays (AOA) -> sheet
  const rows = []

  // fejléc blokk
  rows.push(['Delivery Note / Szállítólevél'])
  rows.push([])
  rows.push(['Delivery note No / Bizonylat sorszáma:', '', '', exportId])
  rows.push([])

  rows.push(['From / Feladó:', '', '', '', 'To / Címzett:'])
  rows.push(['Magma Kft', '', '', '', asText(first.customer || '')])
  rows.push(['H-1211 Budapest, Déli u. 13, Hungary'])
  rows.push(['VAT no.: HU10368152'])
  rows.push([])

  // meta sorok
  rows.push(['Order No.', '', 'Order Date (DMY)', '', 'Payment term', '', 'Delivery date (DMY)'])
  rows.push([asText(first.orderNo || ''), '', asText(first.orderDate || ''), '', 'bank transfer', '', todayDot()])
  rows.push([])

  // táblázat fejléc
  rows.push(['', 'Item', 'Product description', 'Qty', 'Net weight (kg)', 'No. of box', 'No. of pallets', 'Gross weight (kg)'])

  // sorok + összesítés
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

    rows.push([
      '',
      idx + 1,
      asText(r.designation || r.productName || ''),
      qty,
      net,
      boxes,
      pallets,
      gross,
    ])
  })

  rows.push(['', '', 'Total', totalQty, totalNet, totalBoxes, totalPallets, totalGross])

  // megjegyzések blokk (opcionális)
  const notes = selectedOrders.map(o => asText(o.note)).filter(Boolean)
  if (notes.length) {
    rows.push([])
    rows.push(['Megjegyzés:'])
    rows.push([notes.join('\n')])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // oszlopszélesség (csak “szebb”, nem kötelező)
  ws['!cols'] = [
    { wch: 3 },  // A
    { wch: 6 },  // B
    { wch: 38 }, // C
    { wch: 10 }, // D
    { wch: 16 }, // E
    { wch: 12 }, // F
    { wch: 14 }, // G
    { wch: 18 }, // H
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Szállító HU')

  return { wb, exportId }
}