// src/services/orderService.js
import { findTableName } from '../db/tableNames.js'

// --- sql.js helper ---
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

function parseNumberLoose(x) {
  if (x == null) return null
  const s = String(x).trim()
  if (!s) return null

  const cleaned = s
    .replace(/db|mp|g|kg|ora|óra/gi, '')
    .replace(/\s/g, '')
    .replace(/(\d),(\d)/g, '$1.$2') // 12,07 -> 12.07
    .replace(/,/g, '') // 1,000 -> 1000

  const m = cleaned.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

function round1(n) {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

function fmtKg1(n) {
  const r = round1(n)
  if (r == null) return ''
  return `${r.toFixed(1)} kg`
}

function fmtHours0(n) {
  if (n == null || !Number.isFinite(n)) return ''
  return `${Math.round(n)} óra`
}

// ------------------------------------------------------------
// FEJLÉC -> VALÓS SQL OSZLOP FELoldás (mert 1. sor a fejléc)
// ------------------------------------------------------------
const _ordersColCache = new Map() // tableName -> resolver

function getOrdersColumnResolver(db) {
  const table = findTableName(db, 'rendeles')

  const cached = _ordersColCache.get(table)
  if (cached) return cached

  // valós SQL oszlopnevek sorrendben
  const info = db.exec(`PRAGMA table_info('${table}')`)
  const sqlCols = (info?.[0]?.values || []).map(v => v[1]) // name

  // fejléc sor (rowid + *)
  const rows = stmtAllArrays(db, `SELECT rowid, * FROM '${table}' ORDER BY rowid LIMIT 1`)
  const headerRow = rows[0] || []
  const headerLabels = headerRow.slice(1).map(x => norm(x))

  const labelToSqlCol = new Map()
  for (let i = 0; i < headerLabels.length && i < sqlCols.length; i++) {
    if (headerLabels[i]) labelToSqlCol.set(headerLabels[i], sqlCols[i])
  }

  const res = { table, sqlCols, headerLabels, labelToSqlCol }
  _ordersColCache.set(table, res)
  return res
}

function getSqlColByAnyLabel(resolver, labels) {
  for (const l of labels) {
    const col = resolver.labelToSqlCol.get(l)
    if (col) return col
  }
  return null
}

// ------------------------------------------------------------
// EXPORT 1) Rendelések beolvasása
// ------------------------------------------------------------
export async function buildOrdersFromDb(db) {
  const res = getOrdersColumnResolver(db)

  // minden sor: [rowid, c0, c1, ...]
  const rows = stmtAllArrays(db, `SELECT rowid, * FROM '${res.table}' ORDER BY rowid`)
  if (rows.length < 2) return []

  // fejléc (1. sor)
  const header = rows[0].slice(1).map(h => norm(h))

  const iCustomer = idxOf(header, 'Customer', 'Ügyfél', 'Ugyfel')
  const iProductName = idxOf(header, 'Termék neve', 'Termék megnevezés', 'Termek neve', 'Termek megnevezes')
  const iDesignation = idxOf(header, 'Megnevezése', 'Megnevezés', 'Megnevezes')
  const iNote = idxOf(header, 'Megjegyzés', 'Megjegyzes', 'Note')

  const iOwnOrderNo = idxOf(header, 'Saját rendelési szám', 'Sajat rendelési szam')
  const iOrderNo = idxOf(header, 'Rendelési szám', 'Rendelesi szam')
  const iAmount = idxOf(header, 'Amount/pc', 'Amount')

  const iOrderDate = idxOf(header, 'Order date (year/month/day)', 'Order date (y/m/)', 'Order date')
  const iReqDate = idxOf(
    header,
    'Required delivery date (year/month/day)',
    'Required delivery date (y/m/d)',
    'Required delivery date',
    'Required delivery'
  )

  const iPickupDate = idxOf(header, 'Actual pickup date (year/month/day)', 'Actual pickup date')
  const iInvoiced = idxOf(header, 'Számlázva (x)', 'Számlázva', 'Szamlazva')
  const iReady = idxOf(header, 'Szállításra kész', 'Szallitasra kesz')
  const iSurface = idxOf(header, 'Felületkezelés', 'Felulettkezeles')
  const iMaterial = idxOf(header, 'Anyag', 'Material')

  const iBoxes = idxOf(header, 'Dobozok száma')
  const iPallets = idxOf(header, 'Össz raklapok száma')
  const iGross = idxOf(header, 'Össz bruttó súly')
  const iReqMat = idxOf(header, 'Szükséges anyagmennyiség')
  const iPlanned = idxOf(header, 'Tervezett gyártási idő')

  const iDeliveryNote = idxOf(header, 'Szállítólevél', 'Szallitolevel')
  const iStatus = idxOf(header, 'Státusz', 'Status', 'Státus')

  const out = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowid = row[0]
    const r = row.slice(1)

    const amount = iAmount >= 0 ? (parseNumberLoose(r[iAmount]) ?? 0) : 0

    const boxesCount = iBoxes >= 0 ? (parseNumberLoose(r[iBoxes]) ?? null) : null
    const palletsCount = iPallets >= 0 ? (parseNumberLoose(r[iPallets]) ?? null) : null

    out.push({
      id: rowid,
      rowid,

      customer: iCustomer >= 0 ? norm(r[iCustomer]) : '',
      productName: iProductName >= 0 ? norm(r[iProductName]) : '',
      designation: iDesignation >= 0 ? norm(r[iDesignation]) : '',
      note: iNote >= 0 ? norm(r[iNote]) : '',

      ownOrderNo: iOwnOrderNo >= 0 ? norm(r[iOwnOrderNo]) : '',
      orderNo: iOrderNo >= 0 ? norm(r[iOrderNo]) : '',
      material: iMaterial >= 0 ? norm(r[iMaterial]) : '',
      surface: iSurface >= 0 ? norm(r[iSurface]) : '',

      amountPc: amount,

      orderDate: iOrderDate >= 0 ? norm(r[iOrderDate]) : '',
      requiredDate: iReqDate >= 0 ? norm(r[iReqDate]) : '',

      pickupDate: iPickupDate >= 0 ? norm(r[iPickupDate]) : '',
      invoiced: iInvoiced >= 0 ? norm(r[iInvoiced]) : '',
      ready: iReady >= 0 ? norm(r[iReady]) : '',

      boxesCount: boxesCount != null ? Math.round(boxesCount) : null,
      palletsCount: palletsCount != null ? Math.round(palletsCount) : null,

      // string formátum (pl. "12.3 kg", "10 óra")
      grossWeightKg: iGross >= 0 ? norm(r[iGross]) : '',
      requiredMaterialKg: iReqMat >= 0 ? norm(r[iReqMat]) : '',
      plannedProductionHours: iPlanned >= 0 ? norm(r[iPlanned]) : '',

      deliveryNote: iDeliveryNote >= 0 ? norm(r[iDeliveryNote]) : '',
      status: iStatus >= 0 ? norm(r[iStatus]) : '',
    })
  }

  return out
}

// ------------------------------------------------------------
// EXPORT 2) Státusz mentése (Dropdown változás)
// ------------------------------------------------------------
export function updateOrderStatus(db, rowid, newStatus) {
  const res = getOrdersColumnResolver(db)
  const sqlCol = getSqlColByAnyLabel(res, ['Státusz', 'Status', 'Státus'])
  if (!sqlCol) {
    throw new Error('Nem található a "Státusz" oszlop a rendelés táblában (fejléc alapján).')
  }

  const stmt = db.prepare(`UPDATE '${res.table}' SET "${sqlCol}" = ? WHERE rowid = ?`)
  stmt.run([newStatus, rowid])
  stmt.free()
}

// ------------------------------------------------------------
// EXPORT 3) Új rendelés beszúrása (New dialog -> Save)
// ------------------------------------------------------------
export function createOrder(db, data) {
  const res = getOrdersColumnResolver(db)

  // üres sor az összes oszlopra
  const values = res.sqlCols.map(() => '')

  const setByLabels = (labels, value) => {
    const col = getSqlColByAnyLabel(res, labels)
    if (!col) return
    const idx = res.sqlCols.indexOf(col)
    if (idx >= 0) values[idx] = value ?? ''
  }

  setByLabels(['Customer', 'Ügyfél', 'Ugyfel'], data.customer)
  setByLabels(['Termék neve', 'Termék megnevezés', 'Termek neve', 'Termek megnevezes'], data.productName)
  setByLabels(['Megnevezése', 'Megnevezés', 'Megnevezes'], data.designation)
  setByLabels(['Megjegyzés', 'Megjegyzes', 'Note'], data.note)
  setByLabels(['Saját rendelési szám', 'Sajat rendelési szam'], data.ownOrderNo)
  setByLabels(['Rendelési szám', 'Rendelesi szam'], data.orderNo)
  setByLabels(['Anyag', 'Material'], data.material)
  setByLabels(['Amount/pc', 'Amount'], String(data.amountPc ?? ''))

  setByLabels(['Order date (year/month/day)', 'Order date (y/m/)', 'Order date'], data.orderDate)
  setByLabels(
    [
      'Required delivery date (year/month/day)',
      'Required delivery date (y/m/d)',
      'Required delivery date',
      'Required delivery',
    ],
    data.requiredDate
  )

  setByLabels(['Felületkezelés', 'Felulettkezeles'], data.surface)
  setByLabels(['Dobozok száma'], data.boxesCount)
  setByLabels(['Össz raklapok száma'], data.palletsCount)

  setByLabels(['Össz bruttó súly'], data.grossWeightKg)
  setByLabels(['Szükséges anyagmennyiség'], data.requiredMaterialKg)
  setByLabels(['Tervezett gyártási idő'], data.plannedProductionHours)

  setByLabels(['Státusz', 'Status', 'Státus'], data.status ?? 'Folyamatban')

  const colsSql = res.sqlCols.map(c => `"${c}"`).join(', ')
  const qs = res.sqlCols.map(() => '?').join(', ')
  const stmt = db.prepare(`INSERT INTO '${res.table}' (${colsSql}) VALUES (${qs})`)
  stmt.run(values)
  stmt.free()
}

// ------------------------------------------------------------
// EXPORT 4) Általános mező frissítés (dialog mentés + számolt mezők)
// ------------------------------------------------------------
const FIELD_TO_HEADER_LABELS = {
  note: ['Megjegyzés', 'Megjegyzes', 'Note'],
  ownOrderNo: ['Saját rendelési szám', 'Sajat rendelési szam'],
  material: ['Anyag', 'Material'],
  orderNo: ['Rendelési szám', 'Rendelesi szam'],
  amountPc: ['Amount/pc', 'Amount'],

  // ✅ Edit dialogban is menthető Required date
  requiredDate: [
    'Required delivery date (year/month/day)',
    'Required delivery date (y/m/d)',
    'Required delivery date',
    'Required delivery',
  ],

  surface: ['Felületkezelés', 'Felulettkezeles'],
  boxesCount: ['Dobozok száma'],
  palletsCount: ['Össz raklapok száma'],

  grossWeightKg: ['Össz bruttó súly'],
  requiredMaterialKg: ['Szükséges anyagmennyiség'],
  plannedProductionHours: ['Tervezett gyártási idő'],
}

function toDbStringOrEmpty(value) {
  if (value == null) return ''
  const s = String(value).trim()
  return s ? s : ''
}

export function updateOrderFields(db, rowid, patch) {
  const res = getOrdersColumnResolver(db)

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

// ------------------------------------------------------------
// EXPORT 5) Számított mezők
// dobozok = ceil(amount / (doboz/db))
// raklapok = ceil(dobozok / (doboz/raklap))
// anyagKg = (amount * weightPerPcG)/1000  -> 1 tized + " kg"
// bruttóKg = anyagKg + (raklapok * 20)    -> 1 tized + " kg"
// gyártIdő = (amount * cycleTime)/3600    -> 0 tized + " óra"
// ------------------------------------------------------------
export function computeBoxesCount(amountPc, boxPer) {
  const a = parseNumberLoose(amountPc)
  const per = parseNumberLoose(boxPer)
  if (a == null) return ''
  if (per == null || per <= 0) return ''
  return String(Math.ceil(a / per))
}

export function computePalletsCount(boxesCount, boxPerPallet) {
  const b = parseNumberLoose(boxesCount)
  const per = parseNumberLoose(boxPerPallet)
  if (b == null) return ''
  if (per == null || per <= 0) return ''
  return String(Math.ceil(b / per))
}

export function computeRequiredMaterialKg(amountPc, weightPerPcG) {
  const a = parseNumberLoose(amountPc)
  const w = parseNumberLoose(weightPerPcG)
  if (a == null) return ''
  if (w == null) return ''
  const kg = (a * w) / 1000
  return fmtKg1(kg)
}

export function computeGrossWeightKg(requiredMaterialKgStr, palletsCount) {
  const matKg = parseNumberLoose(requiredMaterialKgStr)
  const p = parseNumberLoose(palletsCount)
  if (matKg == null) return ''
  if (p == null) return fmtKg1(matKg)
  const gross = matKg + p * 20
  return fmtKg1(gross)
}

export function computePlannedProductionHours(amountPc, cycleTimeSeconds) {
  const a = parseNumberLoose(amountPc)
  const c = parseNumberLoose(cycleTimeSeconds)
  if (a == null) return ''
  if (c == null) return ''
  const hours = (a * c) / 3600
  return fmtHours0(hours)
}

// ------------------------------------------------------------
// EXPORT 6) Tömeges törlés (selected rows)
// ------------------------------------------------------------
export function deleteOrders(db, rowids) {
  const res = getOrdersColumnResolver(db)
  const ids = Array.isArray(rowids) ? rowids : []
  if (!ids.length) return

  const qs = ids.map(() => '?').join(', ')
  const stmt = db.prepare(`DELETE FROM '${res.table}' WHERE rowid IN (${qs})`)
  stmt.run(ids)
  stmt.free()
}