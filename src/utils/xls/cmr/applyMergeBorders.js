import * as XLSX from 'xlsx-js-style'

const mk = () => ({ style: 'thin', color: { rgb: '000000' } })

/**
 * Ráteszi a border-t egy merge tartomány SZÉLEIRE.
 * Ez segít, ha a HTML/CSS template-ben a border valójában a tartomány több celláján volt szétosztva,
 * és a parse után Excelben "lyukas" / hiányos lesz.
 */
export function applyMergeBorder(
  ws,
  merge,
  sides = { top: true, right: true, bottom: true, left: true },
) {
  const { s, e } = merge

  function ensureCell(r, c) {
    const addr = XLSX.utils.encode_cell({ r, c })
    if (!ws[addr]) ws[addr] = { t: 's', v: '' }
    ws[addr].s = ws[addr].s || {}
    ws[addr].s.border = ws[addr].s.border || {}
    return ws[addr]
  }

  for (let c = s.c; c <= e.c; c++) {
    if (sides.top) ensureCell(s.r, c).s.border.top = mk()
    if (sides.bottom) ensureCell(e.r, c).s.border.bottom = mk()
  }

  for (let r = s.r; r <= e.r; r++) {
    if (sides.left) ensureCell(r, s.c).s.border.left = mk()
    if (sides.right) ensureCell(r, e.c).s.border.right = mk()
  }
}