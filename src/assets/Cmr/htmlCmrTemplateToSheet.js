import * as XLSX from 'xlsx-js-style'

function colName(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
function toA1(r, c) {
  return `${colName(c + 1)}${r + 1}`
}

function borderObj({ top, right, bottom, left }) {
  const mk = (on) => (on ? { style: 'thin', color: { rgb: '000000' } } : undefined)
  return {
    top: mk(top),
    right: mk(right),
    bottom: mk(bottom),
    left: mk(left),
  }
}

function parseCssClasses(cssText) {
  const map = new Map()
  const re = /\.([a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/g
  let m
  while ((m = re.exec(cssText))) {
    map.set(m[1], m[2])
  }
  return map
}

function sideSolid(styleText, side) {
  const re = new RegExp(`border-${side}\\s*:\\s*[^;]*\\bsolid\\b`, 'i')
  return re.test(styleText)
}

function buildBorderFromStyleText(styleText) {
  const b = {
    top: sideSolid(styleText, 'top'),
    right: sideSolid(styleText, 'right'),
    bottom: sideSolid(styleText, 'bottom'),
    left: sideSolid(styleText, 'left'),
  }
  if (!b.top && !b.right && !b.bottom && !b.left) return null
  return borderObj(b)
}

function ptToPx(pt) {
  const n = Number(pt)
  return Number.isFinite(n) ? Math.round((n * 4) / 3) : undefined
}

export function htmlAndCssToWorksheet(htmlText, cssText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html')
  const table = doc.querySelector('table')
  if (!table) throw new Error('Invalid HTML: could not find <table>')

  const cssClasses = parseCssClasses(cssText)
  const ws = {}

  // ---- Col widths ----
  const colEls = table.querySelectorAll('col')
  if (colEls?.length) {
    ws['!cols'] = Array.from(colEls).map((col) => {
      const style = col.getAttribute('style') || ''
      const pt = style.match(/width:\s*([0-9.]+)pt/i)?.[1]
      if (pt) return { wpx: ptToPx(pt) }
      const w = Number(col.getAttribute('width') || '')
      return Number.isFinite(w) && w > 0 ? { wch: Math.max(1, Math.round(w / 7)) } : {}
    })
  }

  // ---- Rows heights ----
  const trEls = Array.from(table.querySelectorAll('tr'))
  if (trEls.length) {
    ws['!rows'] = trEls.map((tr) => {
      const style = tr.getAttribute('style') || ''
      const pt = style.match(/height:\s*([0-9.]+)pt/i)?.[1]
      if (pt) return { hpx: ptToPx(pt) }
      const h = Number(tr.getAttribute('height') || '')
      return Number.isFinite(h) && h > 0 ? { hpx: h } : {}
    })
  }

  // ---- Grid + merges + cells ----
  const grid = []
  ws['!merges'] = []

  trEls.forEach((tr, r) => {
    if (!grid[r]) grid[r] = []
    let c = 0

    const tds = Array.from(tr.children).filter((el) => el.tagName === 'TD' || el.tagName === 'TH')
    for (const td of tds) {
      while (grid[r][c]) c++

      const rowspan = Number(td.getAttribute('rowspan') || 1)
      const colspan = Number(td.getAttribute('colspan') || 1)

      const addr = toA1(r, c)
      const text = (td.textContent || '').replace(/\u00a0/g, ' ').trim()

      const cls = (td.getAttribute('class') || '').trim()
      const inlineStyle = td.getAttribute('style') || ''
      const classStyle = cls ? (cssClasses.get(cls) || '') : ''
      const styleText = `${classStyle};${inlineStyle}`

      ws[addr] = { t: 's', v: text }
      ws[addr].s = ws[addr].s || {}
      ws[addr].s.alignment = { wrapText: true, vertical: 'top' }

      const border = buildBorderFromStyleText(styleText)
      if (border) ws[addr].s.border = border

      if (rowspan > 1 || colspan > 1) {
        ws['!merges'].push({ s: { r, c }, e: { r: r + rowspan - 1, c: c + colspan - 1 } })
      }

      for (let rr = r; rr < r + rowspan; rr++) {
        if (!grid[rr]) grid[rr] = []
        for (let cc = c; cc < c + colspan; cc++) grid[rr][cc] = true
      }

      c += colspan
    }
  })

  const maxR = trEls.length || 1
  const maxC = ws['!cols']?.length || 12
  ws['!ref'] = `A1:${colName(maxC)}${maxR}`

  return ws
}

export function worksheetToWorkbook(ws, sheetName = 'CMR') {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}