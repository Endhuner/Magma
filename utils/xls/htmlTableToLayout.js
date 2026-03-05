export function htmlTableToLayout(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) throw new Error('Invalid HTML: could not find <table>')

  const layout = {
    cols: [],      // [{ wPx }]
    rows: [],      // [{ hPx }]
    merges: [],    // [{ s:{r,c}, e:{r,c} }]
    cells: {},     // { "A1": { v, border } }
  }

  // col widths (optional)
  const cols = table.querySelectorAll('colgroup col')
  if (cols?.length) {
    layout.cols = Array.from(cols).map((col) => {
      const w = (col.getAttribute('width') || col.style.width || '').toString()
      const m = w.match(/(\d+)(px)?/)
      return m ? { wPx: Number(m[1]) } : {}
    })
  }

  // build grid with rowspan/colspan
  const grid = [] // grid[r][c] = true if occupied
  const trs = Array.from(table.querySelectorAll('tr'))

  trs.forEach((tr, r) => {
    if (!grid[r]) grid[r] = []
    let c = 0

    const tds = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH')
    for (const td of tds) {
      while (grid[r][c]) c++

      const rowspan = Number(td.getAttribute('rowspan') || 1)
      const colspan = Number(td.getAttribute('colspan') || 1)

      // value
      const text = (td.textContent || '').replace(/\u00a0/g, ' ').trim()

      // very basic border detect (inline)
      const style = td.getAttribute('style') || ''
      const border = {
        top: /border-top\s*:\s*[^;]*\bsolid\b/i.test(style),
        right: /border-right\s*:\s*[^;]*\bsolid\b/i.test(style),
        bottom: /border-bottom\s*:\s*[^;]*\bsolid\b/i.test(style),
        left: /border-left\s*:\s*[^;]*\bsolid\b/i.test(style),
      }

      const addr = toA1(r, c)
      layout.cells[addr] = { v: text, border }

      // merge record
      if (rowspan > 1 || colspan > 1) {
        layout.merges.push({
          s: { r, c },
          e: { r: r + rowspan - 1, c: c + colspan - 1 },
        })
      }

      // mark occupied
      for (let rr = r; rr < r + rowspan; rr++) {
        if (!grid[rr]) grid[rr] = []
        for (let cc = c; cc < c + colspan; cc++) grid[rr][cc] = true
      }

      c += colspan
    }
  })

  return layout
}

function toA1(r, c) {
  return `${colName(c + 1)}${r + 1}`
}

function colName(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}