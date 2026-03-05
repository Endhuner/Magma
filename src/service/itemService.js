// src/services/itemService.js
// TELJES fájl (READ + WRITE), úgy, hogy a termékek táblánál:
// - az első sor FEJLÉC
// - ezért a buildItemsFromDb: SELECT rowid,* és id=rowid
// - update/delete: WHERE rowid=?
//
// Ha már vannak más exportjaid (pl. compute...), akkor azokat tartsd meg és ezt építsd bele.

import { findTableName } from '../db/tableNames.js'

function stmtAllArrays(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) out.push(stmt.get())
  stmt.free()
  return out
}

function norm(s) {
  return String(s ?? '').trim()
}

function idxOf(header, ...candidates) {
  for (const c of candidates) {
    const i = header.indexOf(c)
    if (i >= 0) return i
  }
  return -1
}

// ------------------------------------------------------------
// READ
// ------------------------------------------------------------
export async function buildItemsFromDb(db) {
  const tItems = findTableName(db, 'termekek')
  const rows = stmtAllArrays(db, `SELECT rowid, * FROM '${tItems}' ORDER BY rowid`)
  if (rows.length < 2) return []

  // 1. sor: fejléc (rowid + címkék)
  const header = rows[0].slice(1).map(h => norm(h))

  const iCustomer = idxOf(header, 'Ügyfél', 'Customer', 'Ügyfel')
  const iDrawNo = idxOf(header, 'Termék rajzszáma', 'Rajzszám', 'Rajzszam')
  const iProductName = idxOf(header, 'Termék megnevezés', 'Termék neve', 'Termek megnevezes', 'Termek neve')
  const iNote = idxOf(header, 'Megjegyzés', 'Megjegyzes', 'Megjegyzés / note', 'Note')
  const iNest = idxOf(header, 'Fészekszáma', 'Feszekszama', 'Fészek száma', 'Feszek szama')
  const iWeightPerPc = idxOf(header, 'Súly/db g', 'Suly/db g', 'Súly/db', 'Suly/db', 'Súly g', 'Suly g')
  const iMaterial = idxOf(header, 'Anyag', 'Material')
  const iSurface = idxOf(header, 'Felületkezelés', 'Felület kezelés', 'Felulettkezeles', 'Surface')
  const iCycle = idxOf(header, 'Ciklus idő', 'Ciklus ido', 'Cycle time')
  const iPostTime = idxOf(header, 'Utómunka idő', 'Utomunka ido', 'Postwork time')
  const iPostWorks = idxOf(header, 'Utómunkák', 'Utomunkak', 'Utómunka', 'Utomunka')
  const iBoxSize = idxOf(header, 'Doboz méret', 'Doboz meret', 'Box size')
  const iBoxPer = idxOf(header, 'Doboz/db', 'Doboz /db', 'Box/pc')
  const iBoxPallet = idxOf(header, 'Doboz/Raklap', 'Doboz / Raklap', 'Box/pallet')
  const iArticle = idxOf(header, 'Arktikál nr.', 'Arktikál nr', 'Artikel nr.', 'Artikel nr', 'Cikkszám', 'Cikkszam')
  const iWarehouse = idxOf(header, 'Raktár', 'Raktar', 'Warehouse')
  const iIngotWeight = idxOf(header, 'Engusz súly', 'Engusz suly', 'Engusz', 'Ingot weight')

  const out = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowid = row[0]
    const r = row.slice(1)

    out.push({
      id: rowid,
      rowid,

      customer: iCustomer >= 0 ? norm(r[iCustomer]) : '',
      drawingNo: iDrawNo >= 0 ? norm(r[iDrawNo]) : '',
      productName: iProductName >= 0 ? norm(r[iProductName]) : '',
      note: iNote >= 0 ? norm(r[iNote]) : '',
      nestNo: iNest >= 0 ? norm(r[iNest]) : '',
      weightPerPcG: iWeightPerPc >= 0 ? norm(r[iWeightPerPc]) : '',
      material: iMaterial >= 0 ? norm(r[iMaterial]) : '',
      surface: iSurface >= 0 ? norm(r[iSurface]) : '',
      cycleTime: iCycle >= 0 ? norm(r[iCycle]) : '',
      postworkTime: iPostTime >= 0 ? norm(r[iPostTime]) : '',
      postworks: iPostWorks >= 0 ? norm(r[iPostWorks]) : '',
      boxSize: iBoxSize >= 0 ? norm(r[iBoxSize]) : '',
      boxPer: iBoxPer >= 0 ? norm(r[iBoxPer]) : '',
      boxPerPallet: iBoxPallet >= 0 ? norm(r[iBoxPallet]) : '',
      articleNo: iArticle >= 0 ? norm(r[iArticle]) : '',
      warehouse: iWarehouse >= 0 ? norm(r[iWarehouse]) : '',
      ingotWeight: iIngotWeight >= 0 ? norm(r[iIngotWeight]) : '',
    })
  }

  return out
}

// ------------------------------------------------------------
// WRITE helpers: fejléc -> SQL oszlop feloldás
// ------------------------------------------------------------
const _itemsColCache = new Map()

function getItemsColumnResolver(db) {
  const table = findTableName(db, 'termekek')

  const cached = _itemsColCache.get(table)
  if (cached) return cached

  const info = db.exec(`PRAGMA table_info('${table}')`)
  const sqlCols = (info?.[0]?.values || []).map(v => v[1])

  // fejléc sor: rowid + *
  const rows = stmtAllArrays(db, `SELECT rowid, * FROM '${table}' ORDER BY rowid LIMIT 1`)
  const headerRow = rows[0] || []
  const headerLabels = headerRow.slice(1).map(x => norm(x))

  const labelToSqlCol = new Map()
  for (let i = 0; i < headerLabels.length && i < sqlCols.length; i++) {
    if (headerLabels[i]) labelToSqlCol.set(headerLabels[i], sqlCols[i])
  }

  const res = { table, sqlCols, headerLabels, labelToSqlCol }
  _itemsColCache.set(table, res)
  return res
}

function getSqlColByAnyLabel(resolver, labels) {
  for (const l of labels) {
    const col = resolver.labelToSqlCol.get(l)
    if (col) return col
  }
  return null
}

const FIELD_TO_HEADER_LABELS = {
  customer: ['Ügyfél', 'Customer', 'Ügyfel'],
  drawingNo: ['Termék rajzszáma', 'Rajzszám', 'Rajzszam'],
  productName: ['Termék megnevezés', 'Termék neve', 'Termek megnevezes', 'Termek neve'],
  note: ['Megjegyzés', 'Megjegyzes', 'Note'],
  nestNo: ['Fészekszáma', 'Feszekszama', 'Fészek száma', 'Feszek szama'],
  weightPerPcG: ['Súly/db g', 'Suly/db g', 'Súly/db', 'Suly/db', 'Súly g', 'Suly g'],
  material: ['Anyag', 'Material'],
  surface: ['Felületkezelés', 'Felület kezelés', 'Felulettkezeles', 'Surface'],
  cycleTime: ['Ciklus idő', 'Ciklus ido', 'Cycle time'],
  postworkTime: ['Utómunka idő', 'Utomunka ido', 'Postwork time'],
  postworks: ['Utómunkák', 'Utomunkak', 'Utómunka', 'Utomunka'],
  boxSize: ['Doboz méret', 'Doboz meret', 'Box size'],
  boxPer: ['Doboz/db', 'Doboz /db', 'Box/pc'],
  boxPerPallet: ['Doboz/Raklap', 'Doboz / Raklap', 'Box/pallet'],
  articleNo: ['Arktikál nr.', 'Arktikál nr', 'Artikel nr.', 'Artikel nr', 'Cikkszám', 'Cikkszam'],
  warehouse: ['Raktár', 'Raktar', 'Warehouse'],
  ingotWeight: ['Engusz súly', 'Engusz suly', 'Engusz', 'Ingot weight'],
}

function toDbStringOrEmpty(value) {
  if (value == null) return ''
  const s = String(value).trim()
  return s ? s : ''
}

export function updateItemFields(db, rowid, patch) {
  const res = getItemsColumnResolver(db)

  const sets = []
  const params = []

  for (const [field, value] of Object.entries(patch || {})) {
    const labels = FIELD_TO_HEADER_LABELS[field]
    if (!labels) continue

    const sqlCol = getSqlColByAnyLabel(res, labels)
    if (!sqlCol) continue

    sets.push(`"${sqlCol}" = ?`)
    params.push(toDbStringOrEmpty(value))
  }

  if (!sets.length) return

  params.push(rowid)
  const stmt = db.prepare(`UPDATE '${res.table}' SET ${sets.join(', ')} WHERE rowid = ?`)
  stmt.run(params)
  stmt.free()
}

export function createItem(db, data) {
  const res = getItemsColumnResolver(db)

  // base row: minden oszlop üres string
  const values = res.sqlCols.map(() => '')

  const setByLabels = (labels, value) => {
    const col = getSqlColByAnyLabel(res, labels)
    if (!col) return
    const idx = res.sqlCols.indexOf(col)
    if (idx >= 0) values[idx] = value ?? ''
  }

  for (const [field, labels] of Object.entries(FIELD_TO_HEADER_LABELS)) {
    setByLabels(labels, toDbStringOrEmpty(data[field]))
  }

  const colsSql = res.sqlCols.map(c => `"${c}"`).join(', ')
  const qs = res.sqlCols.map(() => '?').join(', ')
  const stmt = db.prepare(`INSERT INTO '${res.table}' (${colsSql}) VALUES (${qs})`)
  stmt.run(values)
  stmt.free()
}

export function deleteItems(db, rowids) {
  const res = getItemsColumnResolver(db)
  const ids = Array.isArray(rowids) ? rowids : []
  if (!ids.length) return

  const qs = ids.map(() => '?').join(', ')
  const stmt = db.prepare(`DELETE FROM '${res.table}' WHERE rowid IN (${qs})`)
  stmt.run(ids)
  stmt.free()
}