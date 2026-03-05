import * as XLSX from 'xlsx-js-style'

function thinBorder() {
  return {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }
}

export function layoutToSheet(layout) {
  const ws = {}

  // write cell values + (basic) borders
  for (const [addr, cell] of Object.entries(layout.cells || {})) {
    ws[addr] = { t: 's', v: cell.v ?? '' }

    const b = cell.border || {}
    const any = b.top || b.right || b.bottom || b.left
    if (any) {
      ws[addr].s = ws[addr].s || {}
      // egyszerűsítés: ha bármelyik oldal true, akkor thin border mind a 4 oldalon
      // (ha pontos oldalankénti kell, finomítjuk)
      ws[addr].s.border = thinBorder()
    }

    ws[addr].s = ws[addr].s || {}
    ws[addr].s.alignment = { wrapText: true, vertical: 'top' }
    ws[addr].s.font = { name: 'Arial', sz: 10 }
  }

  // ref beállítás (durva, de működik)
  const used = Object.keys(layout.cells || {})
  ws['!ref'] = used.length ? `${used[0]}:${used[used.length - 1]}` : 'A1:A1'

  // merges
  if (layout.merges?.length) ws['!merges'] = layout.merges.map(m => ({ s: m.s, e: m.e }))

  // col widths
  if (layout.cols?.length) ws['!cols'] = layout.cols.map(c => (c.wPx ? { wpx: c.wPx } : {}))
  if (layout.rows?.length) ws['!rows'] = layout.rows.map(r => (r.hPx ? { hpx: r.hPx } : {}))

  return ws
}