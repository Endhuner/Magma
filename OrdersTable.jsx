// src/components/OrdersTable.jsx
// TELJES FÁJL — DEFAULT EXPORTOS verzió
// + Kiegészítés: Szállító és CMR export gombok (XLSX)

import React, { useMemo, useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { MultiSelect } from 'primereact/multiselect'
import { InputSwitch } from 'primereact/inputswitch'
import { Dropdown } from 'primereact/dropdown'

import { Toolbar } from 'primereact/toolbar'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { ListBox } from 'primereact/listbox'
import { InputTextarea } from 'primereact/inputtextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Calendar } from 'primereact/calendar'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'

import {
  updateOrderStatus,
  createOrder,
  updateOrderFields,
  deleteOrders,
  computeBoxesCount,
  computePalletsCount,
  computeRequiredMaterialKg,
  computeGrossWeightKg,
  computePlannedProductionHours,
} from '../services/orderService.js'
import { persistDb } from '../db/sqliteLoader.js'

// ✅ XLSX export
import { downloadWorkbookXlsx } from '../utils/xls/downloadXlsx.js'
import { buildDeliveryHuWorkbook } from '../utils/xls/buildDeliveryHuXlsx.js'
import { buildCmrWorkbook } from '../utils/xls/buildCmrXlsx.js'

const STATUS_OPTIONS = [
  'Felvéve',
  'Szünetel',
  'Kiszállítva',
  'Csomagolás alatt',
  'Folyamatban',
  'Előkészítve',
  'Javítás alatt',
]

const STATUS_COLORS = {
  'Felvéve': '#fff3b0',
  'Szünetel': '#fff3b0',
  'Kiszállítva': '#d8f5d8',
  'Csomagolás alatt': '#ffe0b2',
  'Folyamatban': '#c8e6c9',
  'Előkészítve': '#bbdefb',
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

function parseYear(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return Number(m[3])

  m = s.match(/^(\d{4})([\/-]\d{1,2})?([\/-]\d{1,2})?$/)
  if (m) return Number(m[1])

  m = s.match(/(20\d{2}|19\d{2})/)
  if (m) return Number(m[1])

  return null
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function dateToYMD(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}/${m}/${d}`
}

function parseYMDToDate(value) {
  if (!value) return null
  const s = String(value).trim()
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  return isNaN(dt.getTime()) ? null : dt
}

export default function OrdersTable({ orders, loading, db, onSaved, customers, items }) {
  const currentYear = new Date().getFullYear()

  const [ordersLocal, setOrdersLocal] = useState([])
  useEffect(() => {
    setOrdersLocal(Array.isArray(orders) ? orders : [])
  }, [orders])

  const [hideDelivered, setHideDelivered] = useState(true)
  const [selectedYears, setSelectedYears] = useState([currentYear])
  const [search, setSearch] = useState('')

  const [selectedOrders, setSelectedOrders] = useState([])
  const metaKey = true

  const [lastAction, setLastAction] = useState(null)

  const [editDialog, setEditDialog] = useState(false)
  const [editSubmitted, setEditSubmitted] = useState(false)
  const [editOrder, setEditOrder] = useState(null)

  const [newDialog, setNewDialog] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emptyNewOrder = useMemo(() => {
    const todayStr = dateToYMD(new Date())
    return {
      customer: null,
      productName: null,
      designation: '',
      note: '',
      ownOrderNo: '',
      orderNo: '',
      material: '',
      amountPc: 0,
      orderDate: todayStr,
      requiredDate: todayStr,
    }
  }, [])

  const [newOrder, setNewOrder] = useState(emptyNewOrder)

  const customerOptions = useMemo(() => {
    const list = Array.isArray(customers) ? customers : []
    const names = list.map(c => (c?.name1 || '').trim()).filter(Boolean)
    const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'hu'))
    return uniq.map(name => ({ name }))
  }, [customers])

  const itemsByCustomer = useMemo(() => {
    const map = new Map()
    const list = Array.isArray(items) ? items : []
    for (const it of list) {
      const cust = String(it?.customer ?? '').trim()
      if (!cust) continue
      const arr = map.get(cust) || []
      arr.push(it)
      map.set(cust, arr)
    }
    return map
  }, [items])

  const productOptions = useMemo(() => {
    const cust = (newOrder.customer || '').trim()
    if (!cust) return []
    const arr = itemsByCustomer.get(cust) || []
    return arr.map((it, idx) => {
      const prodName = String(it?.productName ?? '').trim()
      const drawingNo = String(it?.drawingNo ?? '').trim()
      const secondary = String(it?.note ?? '').trim()
      const value = `${drawingNo || ''}||${prodName || ''}||${idx}`
      return {
        label: prodName || drawingNo || '(nincs név)',
        value,
        drawingNo,
        productName: prodName,
        secondary,
        surface: String(it?.surface ?? '').trim(),
        material: String(it?.material ?? '').trim(),
        boxPer: String(it?.boxPer ?? '').trim(),
        boxPerPallet: String(it?.boxPerPallet ?? '').trim(),
        weightPerPcG: String(it?.weightPerPcG ?? '').trim(),
        cycleTime: String(it?.cycleTime ?? '').trim(),
      }
    })
  }, [newOrder.customer, itemsByCustomer])

  function findItemForOrderRow(row) {
    const cust = String(row?.customer ?? '').trim()
    const productKey = String(row?.productName ?? '').trim()
    if (!cust || !productKey) return null

    const arr = itemsByCustomer.get(cust) || []
    const byDraw = arr.find(it => String(it?.drawingNo ?? '').trim() === productKey)
    if (byDraw) return byDraw
    const byName = arr.find(it => String(it?.productName ?? '').trim() === productKey)
    return byName || null
  }

  function computeAutoFieldsForOrder(row, override = {}) {
    const it = findItemForOrderRow(row)
    const amountPc = override.amountPc ?? row.amountPc

    const boxesCountStr = computeBoxesCount(amountPc, it?.boxPer)
    const palletsCountStr = computePalletsCount(boxesCountStr, it?.boxPerPallet)

    const requiredMaterialKg = computeRequiredMaterialKg(amountPc, it?.weightPerPcG)
    const grossWeightKg = computeGrossWeightKg(requiredMaterialKg, palletsCountStr)
    const plannedProductionHours = computePlannedProductionHours(amountPc, it?.cycleTime)

    return {
      surface: it?.surface ? String(it.surface).trim() : '',
      boxesCount: boxesCountStr ? Number(boxesCountStr) : null,
      palletsCount: palletsCountStr ? Number(palletsCountStr) : null,
      requiredMaterialKg,
      grossWeightKg,
      plannedProductionHours,
    }
  }

  const yearOptions = useMemo(() => {
    const set = new Set()
    for (const o of ordersLocal ?? []) {
      const y = parseYear(o.requiredDate)
      if (y) set.add(y)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [ordersLocal])

  useEffect(() => {
    if (!yearOptions.length) return
    if (selectedYears?.length) return

    if (yearOptions.includes(currentYear)) setSelectedYears([currentYear])
    else setSelectedYears([yearOptions[0]])
  }, [yearOptions, currentYear, selectedYears])

  const activeOrders = useMemo(() => {
    let base = Array.isArray(ordersLocal) ? ordersLocal : []

    if (hideDelivered) base = base.filter(o => !isDelivered(o.status))

    if (selectedYears?.length) {
      const ys = new Set(selectedYears)
      base = base.filter(o => {
        const y = parseYear(o.requiredDate)
        return y != null && ys.has(y)
      })
    }

    return base
  }, [ordersLocal, hideDelivered, selectedYears])

  const searchedOrders = useMemo(() => {
    const q = stripDiacritics(search)
    if (!q) return activeOrders

    const fields = [
      'customer',
      'productName',
      'designation',
      'note',
      'ownOrderNo',
      'material',
      'orderNo',
      'amountPc',
      'orderDate',
      'requiredDate',
      'pickupDate',
      'deliveryNote',
      'status',
    ]

    return activeOrders.filter(o => fields.some(f => stripDiacritics(o?.[f]).includes(q)))
  }, [activeOrders, search])

  const statusBodyTemplate = (rowData) => (
    <Dropdown
      value={rowData.status}
      options={STATUS_OPTIONS}
      onChange={async (e) => {
        const newStatus = e.value
        const id = rowData.rowid ?? rowData.id

        setOrdersLocal(prev =>
          prev.map(o => ((o.rowid ?? o.id) === id ? { ...o, status: newStatus } : o)),
        )

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
        minWidth: '200px',
        backgroundColor: STATUS_COLORS[rowData.status] || '#ffffff',
        border: '1px solid #e5e7eb',
      }}
      panelStyle={{ minWidth: '200px' }}
    />
  )

  const openNew = () => {
    setSubmitted(false)
    const todayStr = dateToYMD(new Date())
    setNewOrder({ ...emptyNewOrder, orderDate: todayStr, requiredDate: todayStr })
    setNewDialog(true)
  }

  const hideNewDialog = () => {
    setNewDialog(false)
    setSubmitted(false)
  }

  const saveNewOrder = async () => {
    setSubmitted(true)
    if (!db) return

    if (!newOrder.customer?.trim()) return
    if (!newOrder.productName?.trim()) return
    if (!newOrder.orderNo?.trim()) return
    if (!newOrder.requiredDate?.trim()) return

    const fakeRow = { customer: newOrder.customer, productName: newOrder.productName, amountPc: newOrder.amountPc }
    const auto = computeAutoFieldsForOrder(fakeRow, { amountPc: newOrder.amountPc })

    try {
      createOrder(db, {
        customer: newOrder.customer,
        productName: newOrder.productName,
        designation: newOrder.designation || '',
        note: newOrder.note,
        ownOrderNo: newOrder.ownOrderNo,
        orderNo: newOrder.orderNo,
        material: newOrder.material,
        amountPc: newOrder.amountPc,
        orderDate: newOrder.orderDate,
        requiredDate: newOrder.requiredDate,
        status: 'Felvéve',
        surface: auto.surface,
        boxesCount: auto.boxesCount == null ? '' : String(auto.boxesCount),
        palletsCount: auto.palletsCount == null ? '' : String(auto.palletsCount),
        requiredMaterialKg: auto.requiredMaterialKg,
        grossWeightKg: auto.grossWeightKg,
        plannedProductionHours: auto.plannedProductionHours,
      })

      await persistDb(db)
      setNewDialog(false)
      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const openEditSelected = () => {
    setEditSubmitted(false)
    if (!selectedOrders?.length) return
    if (selectedOrders.length !== 1) return

    const row = selectedOrders[0]
    setEditOrder({
      rowid: row.rowid ?? row.id,
      note: row.note ?? '',
      ownOrderNo: row.ownOrderNo ?? '',
      material: row.material ?? '',
      orderNo: row.orderNo ?? '',
      amountPc: row.amountPc ?? 0,
      requiredDate: row.requiredDate ?? '',
    })
    setEditDialog(true)
  }

  const hideEditDialog = () => {
    setEditDialog(false)
    setEditSubmitted(false)
    setEditOrder(null)
  }

  const saveEditOrder = async () => {
    setEditSubmitted(true)
    if (!db) return
    if (!editOrder) return
    if (!String(editOrder.orderNo ?? '').trim()) return
    if (!String(editOrder.requiredDate ?? '').trim()) return

    const id = editOrder.rowid
    const before = ordersLocal.find(o => (o.rowid ?? o.id) === id)
    if (before) setLastAction({ type: 'edit', rowid: id, before: { ...before } })

    const baseRow = ordersLocal.find(o => (o.rowid ?? o.id) === id)
    const amountPc = Number(editOrder.amountPc) || 0
    const auto = baseRow ? computeAutoFieldsForOrder(baseRow, { amountPc }) : {}

    const patch = {
      note: editOrder.note,
      ownOrderNo: editOrder.ownOrderNo,
      material: editOrder.material,
      orderNo: editOrder.orderNo,
      amountPc,
      requiredDate: editOrder.requiredDate,
      ...auto,
    }

    setOrdersLocal(prev => prev.map(o => ((o.rowid ?? o.id) === id ? { ...o, ...patch } : o)))

    try {
      updateOrderFields(db, id, patch)
      await persistDb(db)
      setEditDialog(false)
      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const clearSelection = () => setSelectedOrders([])

  const exportDelivery = async () => {
    try {
      if (!selectedOrders?.length) return alert('Nincs kijelölés.')

      const cust = String(selectedOrders[0]?.customer ?? '').trim()
      const mixed = selectedOrders.some(o => String(o?.customer ?? '').trim() !== cust)
      if (mixed) return alert('Kérlek, egyszerre csak egy vevő sorait jelöld ki exporthoz.')

      const { wb, exportId } = buildDeliveryHuWorkbook(selectedOrders)
      const safeId = String(exportId || 'delivery').replaceAll('/', '')
      downloadWorkbookXlsx(wb, `Szallito_${safeId}.xlsx`)
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const exportCmr = async () => {
    try {
      if (!selectedOrders?.length) return alert('Nincs kijelölés.')

      const cust = String(selectedOrders[0]?.customer ?? '').trim()
      const mixed = selectedOrders.some(o => String(o?.customer ?? '').trim() !== cust)
      if (mixed) return alert('Kérlek, egyszerre csak egy vevő sorait jelöld ki exporthoz.')

      const consignee = { name: cust, address: '', city: '', country: '' }

      const { wb, exportId } = buildCmrWorkbook(selectedOrders, consignee)
      const safeId = String(exportId || 'cmr').replaceAll('/', '')
      downloadWorkbookXlsx(wb, `CMR_${safeId}.xlsx`)
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const confirmDeleteSelected = () => {
    if (!selectedOrders?.length) return

    confirmDialog({
      message: 'Biztos hogy törlöd?',
      header: 'Megerősítés',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        await deleteSelected()
      },
      reject: () => {},
    })
  }

  const deleteSelected = async () => {
    if (!db) return
    if (!selectedOrders?.length) return

    const ids = selectedOrders.map(r => r.rowid ?? r.id)

    setLastAction({ type: 'delete', rows: selectedOrders.map(r => ({ ...r })) })

    setOrdersLocal(prev => prev.filter(o => !ids.includes(o.rowid ?? o.id)))
    setSelectedOrders([])

    try {
      deleteOrders(db, ids)
      await persistDb(db)
      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const undoLastAction = async () => {
    if (!db) return
    if (!lastAction) return

    try {
      if (lastAction.type === 'delete') {
        for (const r of lastAction.rows) {
          createOrder(db, {
            customer: r.customer,
            productName: r.productName,
            designation: r.designation || '',
            note: r.note || '',
            ownOrderNo: r.ownOrderNo || '',
            orderNo: r.orderNo || '',
            material: r.material || '',
            amountPc: r.amountPc ?? 0,
            orderDate: r.orderDate || '',
            requiredDate: r.requiredDate || '',
            status: r.status || 'Felvéve',

            surface: r.surface || '',
            boxesCount: r.boxesCount == null ? '' : String(r.boxesCount),
            palletsCount: r.palletsCount == null ? '' : String(r.palletsCount),
            grossWeightKg: r.grossWeightKg || '',
            requiredMaterialKg: r.requiredMaterialKg || '',
            plannedProductionHours: r.plannedProductionHours || '',
          })
        }
        await persistDb(db)
        setLastAction(null)
        if (onSaved) await onSaved()
        return
      }

      if (lastAction.type === 'edit') {
        const b = lastAction.before
        updateOrderFields(db, lastAction.rowid, {
          note: b.note ?? '',
          ownOrderNo: b.ownOrderNo ?? '',
          material: b.material ?? '',
          orderNo: b.orderNo ?? '',
          amountPc: b.amountPc ?? 0,
          requiredDate: b.requiredDate ?? '',
          surface: b.surface ?? '',
          boxesCount: b.boxesCount == null ? '' : String(b.boxesCount),
          palletsCount: b.palletsCount == null ? '' : String(b.palletsCount),
          grossWeightKg: b.grossWeightKg ?? '',
          requiredMaterialKg: b.requiredMaterialKg ?? '',
          plannedProductionHours: b.plannedProductionHours ?? '',
        })
        await persistDb(db)
        setLastAction(null)
        if (onSaved) await onSaved()
        return
      }
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const leftToolbarTemplate = () => (
    <div className="flex flex-wrap gap-2">
      <Button label="New" icon="pi pi-plus" severity="success" onClick={openNew} type="button" />
    </div>
  )

  const rightToolbarTemplate = () => (
    <div className="flex flex-wrap gap-2 justify-content-end">
      <Button label="Szállító" icon="pi pi-file-export" severity="help" onClick={exportDelivery} type="button" disabled={!selectedOrders?.length} />
      <Button label="CMR" icon="pi pi-file-export" severity="warning" onClick={exportCmr} type="button" disabled={!selectedOrders?.length} />

      <Button label="Undo" icon="pi pi-undo" severity="secondary" onClick={undoLastAction} type="button" disabled={!lastAction} />
      <Button label="Clear selection" icon="pi pi-times" severity="secondary" onClick={clearSelection} type="button" disabled={!selectedOrders?.length} />
      <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} type="button" disabled={!selectedOrders?.length} />
      <Button label="Edit selected" icon="pi pi-pencil" severity="info" onClick={openEditSelected} type="button" disabled={!selectedOrders?.length || selectedOrders.length !== 1} />
    </div>
  )

  const newDialogFooter = (
    <>
      <Button label="Cancel" icon="pi pi-times" outlined onClick={hideNewDialog} type="button" />
      <Button label="Save" icon="pi pi-check" type="button" onClick={saveNewOrder} />
    </>
  )

  const editDialogFooter = (
    <>
      <Button label="Cancel" icon="pi pi-times" outlined onClick={hideEditDialog} type="button" />
      <Button label="Save" icon="pi pi-check" type="button" onClick={saveEditOrder} />
    </>
  )

  const header = (
    <div className="flex flex-wrap gap-3 align-items-center justify-content-between">
      <div className="flex flex-wrap gap-3 align-items-center">
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés (csak aktív sorokban)"
            style={{ width: '22rem' }}
          />
        </span>

        <div className="flex align-items-center gap-2">
          <InputSwitch checked={hideDelivered} onChange={(e) => setHideDelivered(e.value)} />
          <span style={{ fontSize: '0.95rem' }}>Kiszállítva</span>
        </div>

        <MultiSelect
          value={selectedYears}
          options={yearOptions}
          onChange={(e) => setSelectedYears(e.value)}
          placeholder="Év"
          display="chip"
          style={{ width: 'auto', minWidth: '6rem' }}
          disabled={!yearOptions.length}
        />
      </div>

      <div className="text-sm text-600">
        {searchedOrders.length} / {(ordersLocal?.length ?? 0)} rendelés
      </div>
    </div>
  )

  return (
    <div>
      <ConfirmDialog />
      <Toolbar className="mb-3" left={leftToolbarTemplate} right={rightToolbarTemplate} />

      <DataTable
        value={searchedOrders}
        paginator
        rows={20}
        rowsPerPageOptions={[10, 20, 50]}
        loading={loading}
        header={header}
        size="small"
        dataKey="id"
        emptyMessage="No orders found."
        selectionMode="multiple"
        selection={selectedOrders}
        onSelectionChange={(e) => setSelectedOrders(e.value)}
        metaKeySelection={metaKey}
        dragSelection
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />

        <Column field="customer" header="Customer" sortable />
        <Column field="productName" header="Termék neve" sortable />
        <Column field="designation" header="Megnevezése" sortable />
        <Column field="note" header="Megjegyzés" />

        <Column field="ownOrderNo" header="Saját rendelési szám" sortable />
        <Column field="material" header="Anyag" sortable />
        <Column field="orderNo" header="Rendelési szám" sortable />
        <Column field="amountPc" header="Amount/pc" sortable />

        <Column field="orderDate" header="Order date (year/month/day)" sortable />
        <Column field="requiredDate" header="Required delivery date (year/month/day)" sortable />
        <Column field="pickupDate" header="Actual pickup date (year/month/day)" sortable />

        <Column field="invoiced" header="Számlázva (x)" sortable />
        <Column field="ready" header="Szállításra kész" sortable />
        <Column field="surface" header="Felületkezelés" sortable />

        <Column field="boxesCount" header="Dobozok száma" sortable />
        <Column field="palletsCount" header="Össz raklapok száma" sortable />

        <Column field="grossWeightKg" header="Össz bruttó súly" sortable />
        <Column field="requiredMaterialKg" header="Szükséges anyagmennyiség" sortable />
        <Column field="plannedProductionHours" header="Tervezett gyártási idő" sortable />

        <Column field="deliveryNote" header="Szállítólevél" sortable />

        <Column field="status" header="Státusz" body={statusBodyTemplate} style={{ minWidth: '200px' }} />
      </DataTable>

      {/* NEW dialog */}
      <Dialog
        visible={newDialog}
        style={{ width: '46rem' }}
        header="New Order"
        modal
        className="p-fluid"
        footer={newDialogFooter}
        onHide={hideNewDialog}
      >
        <div className="formgrid grid">
          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Customer</label>
            <ListBox
              filter
              value={newOrder.customer}
              onChange={(e) => {
                const selected = e.value
                setNewOrder(prev => ({
                  ...prev,
                  customer: selected,
                  productName: null,
                  designation: '',
                  material: '',
                }))
              }}
              options={customerOptions}
              optionLabel="name"
              optionValue="name"
              className="w-full"
              listStyle={{ maxHeight: '16rem' }}
            />
            {submitted && !newOrder.customer && <small className="p-error">Customer kötelező.</small>}
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Termék (rajzszám alapján)</label>
            <ListBox
              filter
              disabled={!newOrder.customer}
              value={null}
              onChange={(e) => {
                const opt = productOptions.find(o => o.value === e.value)
                if (!opt) return

                setNewOrder(prev => ({
                  ...prev,
                  productName: opt.drawingNo || '',
                  designation: opt.productName || '',
                  material: opt.material || prev.material || '',
                }))
              }}
              options={productOptions}
              optionLabel="label"
              optionValue="value"
              filterBy="drawingNo"
              itemTemplate={(opt) => (
                <div style={{ lineHeight: 1.2 }}>
                  <div>{opt.label}</div>
                  {opt.secondary ? <small className="text-600">{opt.secondary}</small> : null}
                  {opt.drawingNo ? (
                    <small className="text-600" style={{ display: 'block' }}>
                      {opt.drawingNo}
                    </small>
                  ) : null}
                </div>
              )}
              className="w-full"
              listStyle={{ maxHeight: '16rem' }}
            />
            {!newOrder.customer && <small className="text-600">Előbb válassz vevőt.</small>}
            {submitted && newOrder.customer && !newOrder.productName && <small className="p-error">Termék kötelező.</small>}
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Megnevezése</label>
            <InputText value={newOrder.designation} onChange={(e) => setNewOrder(prev => ({ ...prev, designation: e.target.value }))} />
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Megjegyzés</label>
            <InputTextarea value={newOrder.note} onChange={(e) => setNewOrder(prev => ({ ...prev, note: e.target.value }))} rows={3} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Saját rendelési szám</label>
            <InputText value={newOrder.ownOrderNo} onChange={(e) => setNewOrder(prev => ({ ...prev, ownOrderNo: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Anyag</label>
            <InputText value={newOrder.material} onChange={(e) => setNewOrder(prev => ({ ...prev, material: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Rendelési szám</label>
            <InputText value={newOrder.orderNo} onChange={(e) => setNewOrder(prev => ({ ...prev, orderNo: e.target.value }))} />
            {submitted && !newOrder.orderNo?.trim() && <small className="p-error">Rendelési szám kötelező.</small>}
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Amount/pc</label>
            <div className="flex align-items-center gap-2">
              <InputNumber
                value={newOrder.amountPc}
                onValueChange={(e) => setNewOrder(prev => ({ ...prev, amountPc: e.value ?? 0 }))}
                showButtons
                buttonLayout="vertical"
                style={{ width: '6rem' }}
                decrementButtonClassName="p-button-secondary"
                incrementButtonClassName="p-button-secondary"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                min={0}
              />
              <span>db</span>
            </div>
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Order date</label>
            <Calendar
              value={parseYMDToDate(newOrder.orderDate)}
              onChange={(e) => setNewOrder(prev => ({ ...prev, orderDate: dateToYMD(e.value) }))}
              dateFormat="dd/mm/yy"
              showIcon
              className="w-full"
            />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Required delivery date</label>
            <Calendar
              value={parseYMDToDate(newOrder.requiredDate)}
              onChange={(e) => setNewOrder(prev => ({ ...prev, requiredDate: dateToYMD(e.value) }))}
              dateFormat="dd/mm/yy"
              showIcon
              className="w-full"
            />
            {submitted && !newOrder.requiredDate?.trim() && <small className="p-error">Required date kötelező.</small>}
          </div>
        </div>
      </Dialog>

      {/* EDIT dialog */}
      <Dialog
        visible={editDialog}
        style={{ width: '36rem' }}
        header="Edit selected order"
        modal
        className="p-fluid"
        footer={editDialogFooter}
        onHide={hideEditDialog}
      >
        {!editOrder ? null : (
          <div className="formgrid grid">
            <div className="field col-12">
              <label className="font-bold mb-2 block">Megjegyzés</label>
              <InputTextarea value={editOrder.note} onChange={(e) => setEditOrder(prev => ({ ...prev, note: e.target.value }))} rows={3} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Saját rendelési szám</label>
              <InputText value={editOrder.ownOrderNo} onChange={(e) => setEditOrder(prev => ({ ...prev, ownOrderNo: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Anyag</label>
              <InputText value={editOrder.material} onChange={(e) => setEditOrder(prev => ({ ...prev, material: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Rendelési szám</label>
              <InputText
                value={editOrder.orderNo}
                onChange={(e) => setEditOrder(prev => ({ ...prev, orderNo: e.target.value }))}
              />
              {editSubmitted && !String(editOrder.orderNo ?? '').trim() && (
                <small className="p-error">Rendelési szám kötelező.</small>
              )}
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Amount/pc</label>
              <InputNumber
                value={editOrder.amountPc}
                onValueChange={(e) => setEditOrder(prev => ({ ...prev, amountPc: e.value ?? 0 }))}
                showButtons
                buttonLayout="vertical"
                decrementButtonClassName="p-button-secondary"
                incrementButtonClassName="p-button-secondary"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                min={0}
              />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Required delivery date</label>
              <Calendar
                value={parseYMDToDate(editOrder.requiredDate)}
                onChange={(e) => setEditOrder(prev => ({ ...prev, requiredDate: dateToYMD(e.value) }))}
                dateFormat="dd/mm/yy"
                showIcon
                className="w-full"
              />
              {editSubmitted && !String(editOrder.requiredDate ?? '').trim() && (
                <small className="p-error">Required date kötelező.</small>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Anyag</label>
              <InputText value={editOrder.material} onChange={(e) => setEditOrder(prev => ({ ...prev, material: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Rendelési szám</label>
              <InputText value={editOrder.orderNo} onChange={(e) => setEditOrder(prev => ({ ...prev, orderNo: e.target.value }))} />
              {editSubmitted && !String(editOrder.orderNo ?? '').trim() && <small className="p-error">Rendelési szám kötelező.</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Amount/pc</label>
              <InputNumber
                value={editOrder.amountPc}
                onValueChange={(e) => setEditOrder(prev => ({ ...prev, amountPc: e.value ?? 0 }))}
                showButtons
                buttonLayout="vertical"
                decrementButtonClassName="p-button-secondary"
                incrementButtonClassName="p-button-secondary"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                min={0}
              />
            </div>