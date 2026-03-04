# PrimeReact DataTable + meglévő SQLite (orders.db)

## Mit csinál ez a projekt?
- A `public/orders.db` fájlt betölti a böngészőbe (sql.js)
- A `Vevők` + `rendelés` táblákból összeállít egy `customers` tömböt
- Ezt kirendereli PrimeReact DataTable-ben (pont olyan oszlopokkal, mint amit küldtél)

## Telepítés / indítás
1) Csomagold ki
2) Terminál a mappába:
   npm install
3) Indítás:
   npm run dev

## Fontos
- A `rendelés` táblában az első sor fejléc (Customer, Amount/pc, stb.), ezért a kód ezt így kezeli.
- Ha a DB-t frissíted, csak cseréld a `public/orders.db` fájlt.
