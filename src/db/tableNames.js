// src/db/tableNames.js
// Unicode-normalizált táblanév kereső (kombinált ékezetek ellen is jó)

function stripDiacritics(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining marks
    .toLowerCase()
    .trim()
}

export function listTableNames(db) {
  const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table'`)
  const names = (res?.[0]?.values || []).map(v => v[0])
  return names
}

export function findTableName(db, wanted) {
  const wantedKey = stripDiacritics(wanted)
  const names = listTableNames(db)

  const hit = names.find(n => stripDiacritics(n) === wantedKey)
  if (!hit) {
    throw new Error(
      `Nem találom a táblát: "${wanted}". Elérhető táblák: ${names.join(', ')}`
    )
  }
  return hit
}