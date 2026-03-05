// src/db/sqliteLoader.js
import initSqlJs from 'sql.js'
import { get, set } from 'idb-keyval'

const DB_KEY = 'orders_db_v1'

async function getSQL() {
  return initSqlJs({
    // Vite alatt így tudja betölteni a wasm fájlokat a node_modules-ból
    locateFile: (file) => `/node_modules/sql.js/dist/${file}`,
  })
}

// 1) IndexedDB-ből tölt, ha van mentett
// 2) különben public/orders.db-ből tölt (első indítás)
// 3) első betöltés után elmenti IndexedDB-be
export async function loadSqliteDbAuto(pathToDbInPublic = '/orders.db') {
  const SQL = await getSQL()

  const saved = await get(DB_KEY)
  if (saved) {
    const u8 = saved instanceof Uint8Array ? saved : new Uint8Array(saved)
    return new SQL.Database(u8)
  }

  const resp = await fetch(pathToDbInPublic, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`Nem tudtam betölteni: ${pathToDbInPublic} (HTTP ${resp.status})`)

  const buf = await resp.arrayBuffer()
  const db = new SQL.Database(new Uint8Array(buf))

  await set(DB_KEY, db.export())
  return db
}

// Minden DB módosítás után hívd (státusz váltás, új rendelés, stb.)
export async function persistDb(db) {
  if (!db) return
  await set(DB_KEY, db.export())
}

// Opcionális: ha egyszer vissza akarod állítani az eredeti public/orders.db-t
export async function resetPersistedDb() {
  await set(DB_KEY, null)
}