// src/services/customerService.js
// Kiegészítés: deleteCustomers(db, rowids)

import { findTableName } from '../db/tableNames.js'

// --- sql.js helper ---
function stmtAll(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const out = []
  while (stmt.step()) out.push(stmt.getAsObject())
  stmt.free()
  return out
}

function norm(s) {
  return String(s ?? '').trim()
}

function toDbStringOrEmpty(value) {
  if (value == null) return ''
  const s = String(value).trim()
  return s ? s : ''
}

export async function buildCustomersFromDb(db) {
  const tCustomers = findTableName(db, 'vevok')

  const rows = stmtAll(
    db,
    `SELECT rowid AS id, * FROM '${tCustomers}' ORDER BY rowid`
  )

  return rows.map(r => ({
    id: Number(r.id),

    name1: norm(r['Vevő név']),
    language: norm(r['Szállító Nyelve']),
    city: norm(r['Város']),
    zip: norm(r['Irányítószám']),
    street: norm(r['Utca, házszám']),
    country: norm(r['Ország']),
    address: norm(r['Cím']),
    taxNumber: norm(r['Adószám']),
    name2: norm(r['Vevő név2']),
  }))
}

const FIELD_TO_DB_COL = {
  name1: 'Vevő név',
  language: 'Szállító Nyelve',
  city: 'Város',
  zip: 'Irányítószám',
  street: 'Utca, házszám',
  country: 'Ország',
  address: 'Cím',
  taxNumber: 'Adószám',
  name2: 'Vevő név2',
}

export function updateCustomerFields(db, rowid, patch) {
  const table = findTableName(db, 'vevok')

  const sets = []
  const params = []

  for (const [field, value] of Object.entries(patch || {})) {
    const col = FIELD_TO_DB_COL[field]
    if (!col) continue
    sets.push(`"${col}" = ?`)
    params.push(toDbStringOrEmpty(value))
  }

  if (!sets.length) return

  params.push(rowid)
  const stmt = db.prepare(`UPDATE '${table}' SET ${sets.join(', ')} WHERE rowid = ?`)
  stmt.run(params)
  stmt.free()
}

export function createCustomer(db, data) {
  const table = findTableName(db, 'vevok')

  const cols = Object.values(FIELD_TO_DB_COL)
  const colsSql = cols.map(c => `"${c}"`).join(', ')
  const qs = cols.map(() => '?').join(', ')

  const values = [
    toDbStringOrEmpty(data.name1),
    toDbStringOrEmpty(data.language),
    toDbStringOrEmpty(data.city),
    toDbStringOrEmpty(data.zip),
    toDbStringOrEmpty(data.street),
    toDbStringOrEmpty(data.country),
    toDbStringOrEmpty(data.address),
    toDbStringOrEmpty(data.taxNumber),
    toDbStringOrEmpty(data.name2),
  ]

  const stmt = db.prepare(`INSERT INTO '${table}' (${colsSql}) VALUES (${qs})`)
  stmt.run(values)
  stmt.free()
}

export function deleteCustomers(db, rowids) {
  const table = findTableName(db, 'vevok')
  const ids = Array.isArray(rowids) ? rowids : []
  if (!ids.length) return

  const qs = ids.map(() => '?').join(', ')
  const stmt = db.prepare(`DELETE FROM '${table}' WHERE rowid IN (${qs})`)
  stmt.run(ids)
  stmt.free()
}