// src/App.jsx
// TELJES FÁJL — default importtal az OrdersTable-hez.

import React, { useEffect, useState } from 'react'
import { Button } from 'primereact/button'

import { CustomersTable } from './components/CustomersTable.jsx'
import OrdersTable from './components/OrdersTable.jsx'
import { ItemsTable } from './components/ItemsTable.jsx'

import { loadSqliteDbAuto } from './db/sqliteLoader.js'

import { buildCustomersFromDb } from './services/customerService.js'
import { buildOrdersFromDb } from './services/orderService.js'
import { buildItemsFromDb } from './services/itemService.js'

export default function App() {
  const [tab, setTab] = useState('orders')

  const [db, setDb] = useState(null)

  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setError('')

        const db = await loadSqliteDbAuto('/orders.db')
        setDb(db)

        const [c, o, it] = await Promise.all([
          buildCustomersFromDb(db),
          buildOrdersFromDb(db),
          buildItemsFromDb(db),
        ])

        setCustomers(c)
        setOrders(o)
        setItems(it)
      } catch (e) {
        console.error(e)
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const reloadCustomers = async () => {
    if (!db) return
    try {
      const c = await buildCustomersFromDb(db)
      setCustomers(c)
    } catch (e) {
      console.error(e)
      setError(e?.message || String(e))
    }
  }

  const reloadOrders = async () => {
    if (!db) return
    try {
      const o = await buildOrdersFromDb(db)
      setOrders(o)
    } catch (e) {
      console.error(e)
      setError(e?.message || String(e))
    }
  }

  const reloadItems = async () => {
    if (!db) return
    try {
      const it = await buildItemsFromDb(db)
      setItems(it)
    } catch (e) {
      console.error(e)
      setError(e?.message || String(e))
    }
  }

  return (
    <div className="p-3">
      <div className="flex gap-2 mb-3">
        <Button label="Vevők" onClick={() => setTab('customers')} outlined={tab !== 'customers'} />
        <Button label="Rendelések" onClick={() => setTab('orders')} outlined={tab !== 'orders'} />
        <Button label="Tételek" onClick={() => setTab('items')} outlined={tab !== 'items'} />
      </div>

      {error ? (
        <div className="p-3 border-1 surface-border border-round text-red-600">
          <div className="font-semibold mb-2">Hiba</div>
          <div className="white-space-pre-wrap">{error}</div>
        </div>
      ) : tab === 'customers' ? (
        <CustomersTable customers={customers} loading={loading} db={db} onSaved={reloadCustomers} />
      ) : tab === 'orders' ? (
        <OrdersTable
          orders={orders}
          loading={loading}
          db={db}
          onSaved={reloadOrders}
          customers={customers}
          items={items}
        />
      ) : (
        <ItemsTable items={items} loading={loading} db={db} onSaved={reloadItems} />
      )}
    </div>
  )
}