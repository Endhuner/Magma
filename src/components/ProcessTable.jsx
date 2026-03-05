// src/components/ProcessTable.jsx
// Folyamat nézet: aktív gyártási rendelések státusz szerinti csoportosításban

import React, { useMemo, useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { InputSwitch } from 'primereact/inputswitch'
import { Dropdown } from 'primereact/dropdown'

import { updateOrderStatus } from '../services/orderService.js'
import { persistDb } from '../db/sqliteLoader.js'

const STATUS_OPTIONS = [
  'Felvéve',
  'Szünetel',
  'Kiszállítva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
]

const STATUS_ORDER = [
  'Folyamatban',
  'Előkészítve',
  'Csomagolás alatt',
  'Felvéve',
  'Javítás alatt',
  'Szünetel',
  'Kiszállítva',
]

const STATUS_COLORS = {
  Felvéve: '#fff3b0',
  Szünetel: '#fff3b0',
  Kiszállítva: '#d8f5d8',
  'Csomagolás alatt': '#ffe0b2',
  Folyamatban: '#c8e6c9',
  Előkészítve: '#bbdefb',
  'Javítás alatt': '#f8bbd0',
}

function stripDiacritics(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isDelivered(status) {
  const st = stripDiacritics(status)
  return st === 'kiszallitva' || st.includes('kiszallitva')
}

export function ProcessTable({ orders, loading, db, onSaved }) {
  const [ordersLocal, setOrdersLocal] = useState([])
  useEffect(() => {
    setOrdersLocal(Array.isArray(orders) ? orders : [])
  }, [orders])

  const [hideDelivered, setHideDelivered] = useState(true)
  const [search, setSearch] = useState('')

  const statusSortIndex = status => {
    const idx = STATUS_ORDER.indexOf(status)
    return idx >= 0 ? idx : STATUS_ORDER.length
  }

  const activeOrders = useMemo(() => {
    let base = Array.isArray(ordersLocal) ? ordersLocal : []
    if (hideDelivered) base = base.filter(o => !isDelivered(o.status))
    return base
  }, [ordersLocal, hideDelivered])

  const searchedOrders = useMemo(() => {
    const q = stripDiacritics(search)
    if (!q) return activeOrders

    const fields = ['customer', 'productName', 'designation', 'note', 'ownOrderNo', 'material', 'orderNo', 'status']
    return activeOrders.filter(o => fields.some(f => stripDiacritics(o?.[f]).includes(q)))
  }, [activeOrders, search])

  const sortedOrders = useMemo(() => {
    return [...searchedOrders].sort((a, b) => {
      const si = statusSortIndex(a.status) - statusSortIndex(b.status)
      if (si !== 0) return si
      return String(a.requiredDate ?? '').localeCompare(String(b.requiredDate ?? ''))
    })
  }, [searchedOrders])

  const statusBodyTemplate = rowData => (
    <Dropdown
      value={rowData.status}
      options={STATUS_OPTIONS}
      onChange={async e => {
        const newStatus = e.value
        const id = rowData.rowid ?? rowData.id

        setOrdersLocal(prev => prev.map(o => ((o.rowid ?? o.id) === id ? { ...o, status: newStatus } : o)))

        if (!db) return

        try {
          updateOrderStatus(db, id, newStatus)
          await persistDb(db)
          if (onSaved) await onSaved()
        } catch (err) {
          console.error(err)
          alert(err?.message || String(err))
        }
      }}
      placeholder="Státusz"
      style={{
        width: '100%',
        minWidth: '180px',
        backgroundColor: STATUS_COLORS[rowData.status] || '#ffffff',
        border: '1px solid #e5e7eb',
      }}
      panelStyle={{ minWidth: '180px' }}
    />
  )

  const rowGroupHeaderTemplate = rowData => {
    const status = rowData.status
    const count = sortedOrders.filter(o => o.status === status).length
    return (
      <div
        className="flex align-items-center gap-2 font-bold"
        style={{
          backgroundColor: STATUS_COLORS[status] || '#f5f5f5',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
        }}
      >
        <span>{status || '(nincs státusz)'}</span>
        <span className="text-sm font-normal text-600">({count} rendelés)</span>
      </div>
    )
  }

  const header = (
    <div className="flex flex-wrap gap-3 align-items-center justify-content-between">
      <div className="flex flex-wrap gap-3 align-items-center">
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Keresés..."
            style={{ width: '20rem' }}
          />
        </span>

        <div className="flex align-items-center gap-2">
          <InputSwitch checked={hideDelivered} onChange={e => setHideDelivered(e.value)} />
          <span style={{ fontSize: '0.95rem' }}>Kiszállítva elrejtése</span>
        </div>
      </div>

      <div className="text-sm text-600">
        {sortedOrders.length} / {ordersLocal?.length ?? 0} rendelés
      </div>
    </div>
  )

  return (
    <div>
      <DataTable
        value={sortedOrders}
        paginator
        rows={50}
        rowsPerPageOptions={[20, 50, 100]}
        loading={loading}
        header={header}
        size="small"
        dataKey="id"
        emptyMessage="Nincs aktív rendelés."
        rowGroupMode="subheader"
        groupRowsBy="status"
        rowGroupHeaderTemplate={rowGroupHeaderTemplate}
        sortField="status"
        sortOrder={1}
        expandableRowGroups
        expandedRows={sortedOrders}
      >
        <Column field="customer" header="Customer" sortable />
        <Column field="productName" header="Termék neve" sortable />
        <Column field="designation" header="Megnevezése" sortable />
        <Column field="ownOrderNo" header="Saját rendelési szám" sortable />
        <Column field="orderNo" header="Rendelési szám" sortable />
        <Column field="amountPc" header="Amount/pc" sortable style={{ width: '7rem' }} />
        <Column field="material" header="Anyag" sortable />
        <Column field="surface" header="Felületkezelés" sortable />
        <Column field="requiredDate" header="Határidő" sortable />
        <Column field="plannedProductionHours" header="Tervezett idő" sortable />
        <Column field="note" header="Megjegyzés" />
        <Column field="status" header="Státusz" body={statusBodyTemplate} style={{ minWidth: '180px' }} />
      </DataTable>
    </div>
  )
}
