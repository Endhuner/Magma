import * as XLSX from 'xlsx-js-style'

function s2ab(s) {
  const buf = new ArrayBuffer(s.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff
  return buf
}

export function downloadWorkbookXlsx(workbook, filename) {
  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'binary',
    cellStyles: true,
    compression: true,
  })

  const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'export.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}