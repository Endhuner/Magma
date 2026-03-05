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
  // támogatja a shorthand-ot is: border: .5pt solid black
  const explicit = new RegExp(`border-${side}\\s*:\\s*[^;]*\\bsolid\\b`, 'i').test(styleText)
  const shorthand = /\bborder\s*:\s*[^;]*\bsolid\b/i.test(styleText)
  return explicit || shorthand
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

function pick(styleText, prop) {
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i')
  return styleText.match(re)?.[1]?.trim()
}

function parseFont(styleText) {
  const familyRaw = pick(styleText, 'font-family')
  const sizeRaw = pick(styleText, 'font-size')
  const weightRaw = pick(styleText, 'font-weight')
  const styleRaw = pick(styleText, 'font-style')
  const decoRaw = pick(styleText, 'text-decoration')
  const colorRaw = pick(styleText, 'color')

  const name = familyRaw ? familyRaw.split(',')[0].trim().replace(/^["']|["']$/g, '') : undefined

  const sz =
    sizeRaw?.toLowerCase().includes('pt')
      ? Number(sizeRaw.toLowerCase().replace('pt', '').trim())
      : Number(sizeRaw)

  const bold = weightRaw ? Number(weightRaw) >= 600 || weightRaw.toLowerCase() === 'bold' : undefined
  const italic = styleRaw ? styleRaw.toLowerCase() === 'italic' : undefined
  const underline = decoRaw ? decoRaw.toLowerCase().includes('underline') : undefined

  let rgb
  if (colorRaw) {
    const c = colorRaw.trim().toLowerCase()
    const hex = c.match(/^#([0-9a-f]{6})$/i)?.[1]
    if (hex) rgb = hex.toUpperCase()
    else if (c === 'black' || c === 'windowtext') rgb = '000000'
    else if (c === 'navy') rgb = '000080'
  }

  const font = {}
  if (name) font.name = name
  if (Number.isFinite(sz)) font.sz = sz
  if (bold !== undefined) font.bold = bold
  if (italic !== undefined) font.italic = italic
  if (underline) font.underline = true
  if (rgb) font.color = { rgb }

  return Object.keys(font).length ? font : null
}

function parseAlignment(styleText) {
  const ta = pick(styleText, 'text-align')?.toLowerCase()
  const va = pick(styleText, 'vertical-align')?.toLowerCase()
  const ws = pick(styleText, 'white-space')?.toLowerCase()

  const alignment = {}

  if (ta === 'left' || ta === 'center' || ta === 'right') alignment.horizontal = ta

  if (va === 'top') alignment.vertical = 'top'
  else if (va === 'middle') alignment.vertical = 'center'
  else if (va === 'bottom') alignment.vertical = 'bottom'

  if (ws === 'nowrap') alignment.wrapText = false
  else if (ws === 'normal') alignment.wrapText = true

  return Object.keys(alignment).length ? alignment : null
}

function ptToPx(pt) {
  const n = Number(pt)
  // 1pt = 96/72 px = 4/3 px
  return Number.isFinite(n) ? (n * 4) / 3 : undefined
}

export function htmlAndCssToWorksheet(htmlText, cssText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html')
  const table = doc.querySelector('table')
  if (!table) throw new Error('Invalid HTML: could not find <table>')

  const cssClasses = parseCssClasses(cssText)
  const ws = {}

  // ---- Col widths ----
  // FIX: az eredeti táblázat oszlopszélességei pixelben (A–K)
  const FIX_COL_WIDTHS_PX = [117, 117, 36, 36, 47, 85, 44, 41, 41, 43, 86]
  ws['!cols'] = FIX_COL_WIDTHS_PX.map((wpx) => ({ wpx }))

  // ---- Rows heights ----
  // szűrés: display:none vagy height=0 sorok ne számítsanak (különben csúszik minden)
  const trEls = Array.from(table.querySelectorAll('tr')).filter((tr) => {
    const st = (tr.getAttribute('style') || '').toLowerCase()
    if (st.includes('display:none')) return false
    const h = Number(tr.getAttribute('height') || '')
    if (Number.isFinite(h) && h === 0) return false
    return true
  })

  if (trEls.length) {
    ws['!rows'] = trEls.map((tr) => {
      const style = tr.getAttribute('style') || ''
      const pt = style.match(/height:\s*([0-9.]+)pt/i)?.[1]
      if (pt) return { hpx: Math.round(ptToPx(pt)) }
      const h = Number(tr.getAttribute('height') || '')
      return Number.isFinite(h) && h > 0 ? { hpx: h } : {}
    })
  }

  // ---- Grid + merges + cells ----
  const grid = []
  const merges = []
  let maxCol = 0

  trEls.forEach((tr, r) => {
    if (!grid[r]) grid[r] = []
    let c = 0

    const tds = Array.from(tr.children).filter((el) => el.tagName === 'TD' || el.tagName === 'TH')
    for (const td of tds) {
      while (grid[r][c]) c++

      const rowspan = Number(td.getAttribute('rowspan') || 1)
      const colspan = Number(td.getAttribute('colspan') || 1)

      maxCol = Math.max(maxCol, c + colspan)

      const addr = toA1(r, c)
      const text = (td.textContent || '').replace(/\u00a0/g, ' ').trim()

      const cls = (td.getAttribute('class') || '').trim()
      const inlineStyle = td.getAttribute('style') || ''
      const classStyle = cls ? (cssClasses.get(cls) || '') : ''
      const styleText = `${classStyle};${inlineStyle}`

      ws[addr] = { t: 's', v: text }

      const border = buildBorderFromStyleText(styleText)
      const font = parseFont(styleText)
      const alignment = parseAlignment(styleText)

      if (border || font || alignment) {
        ws[addr].s = ws[addr].s || {}
        if (border) ws[addr].s.border = border
        if (font) ws[addr].s.font = font
        if (alignment) ws[addr].s.alignment = alignment
      }

      if (rowspan > 1 || colspan > 1) {
        merges.push({ s: { r, c }, e: { r: r + rowspan - 1, c: c + colspan - 1 } })
      }

      for (let rr = r; rr < r + rowspan; rr++) {
        if (!grid[rr]) grid[rr] = []
        for (let cc = c; cc < c + colspan; cc++) grid[rr][cc] = true
      }

      c += colspan
    }
  })

  ws['!merges'] = merges

  const maxR = trEls.length || 1
  const maxC = Math.max(maxCol, ws['!cols']?.length || 0, 1)
  ws['!ref'] = `A1:${colName(maxC)}${maxR}`

  return ws
}

export function worksheetToWorkbook(ws, sheetName = 'CMR') {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}