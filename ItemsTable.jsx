// src/components/ItemsTable.jsx
// TELJES verzió (a duplikálás/jó sor frissítése miatt):
// - Edit/Update mindig a DB rowid-t használja (id=rowid)
// - New / Edit külön dialog
// - Toolbar: Undo, Clear selection, Delete (confirm), Edit selected
//
// FONTOS: ehhez a buildItemsFromDb-nak rowid-t kell adnia (lásd itemService.js lent).

import React, { useMemo, useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { FilterMatchMode } from 'primereact/api'
import { Toolbar } from 'primereact/toolbar'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputTextarea } from 'primereact/inputtextarea'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'

import { persistDb } from '../db/sqliteLoader.js'
import { createItem, updateItemFields, deleteItems } from '../services/itemService.js'

export function ItemsTable({ items, loading, db, onSaved }) {
  // local list
  const [itemsLocal, setItemsLocal] = useState([])
  useEffect(() => {
    setItemsLocal(Array.isArray(items) ? items : [])
  }, [items])

  // filter
  const [globalFilterValue, setGlobalFilterValue] = useState('')
  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  })

  // selection
  const [selectedItems, setSelectedItems] = useState([])
  const metaKey = true

  // NEW dialog
  const [newDialog, setNewDialog] = useState(false)
  const [newSubmitted, setNewSubmitted] = useState(false)

  const emptyNewItem = useMemo(() => ({
    customer: '',
    drawingNo: '',
    productName: '',
    note: '',
    nestNo: '',
    weightPerPcG: '',
    material: '',
    surface: '',
    cycleTime: '',
    postworkTime: '',
    postworks: '',
    boxSize: '',
    boxPer: '',
    boxPerPallet: '',
    articleNo: '',
    warehouse: '',
    ingotWeight: '',
  }), [])

  const [newItem, setNewItem] = useState(emptyNewItem)

  // EDIT dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editSubmitted, setEditSubmitted] = useState(false)
  const [editItem, setEditItem] = useState(null)

  // UNDO
  // { type:'delete', rows: ItemRow[] } | { type:'edit', rowid:number, before: ItemRow }
  const [lastAction, setLastAction] = useState(null)

  const header = useMemo(() => (
    <div className="flex flex-wrap gap-2 align-items-center justify-content-between">
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText
          value={globalFilterValue}
          onChange={(e) => {
            const v = e.target.value
            setGlobalFilterValue(v)
            setFilters({ global: { value: v, matchMode: FilterMatchMode.CONTAINS } })
          }}
          placeholder="Keresés (ügyfél / rajzszám / termék / anyag / raktár...)"
        />
      </span>
      <div className="text-sm text-600">{itemsLocal?.length ?? 0} tétel</div>
    </div>
  ), [globalFilterValue, itemsLocal])

  // ----------------
  // New
  // ----------------
  const openNew = () => {
    setNewSubmitted(false)
    setNewItem(emptyNewItem)
    setNewDialog(true)
  }

  const hideNewDialog = () => {
    setNewDialog(false)
    setNewSubmitted(false)
  }

  const saveNewItem = async () => {
    setNewSubmitted(true)
    if (!db) return
    if (!String(newItem.customer ?? '').trim()) return
    if (!String(newItem.drawingNo ?? '').trim()) return

    try {
      createItem(db, newItem)
      await persistDb(db)
      setNewDialog(false)
      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  // ----------------
  // Edit
  // ----------------
  const openEditSelected = () => {
    setEditSubmitted(false)
    if (!selectedItems?.length) return
    if (selectedItems.length !== 1) return

    const row = selectedItems[0]
    const rowid = row.rowid ?? row.id

    if (!rowid) {
      alert('Hiba: a kijelölt tételnek nincs rowid/id mezője. Ellen  rizd a buildItemsFromDb-t (id=rowid kell).')
      return
    }

    setEditItem({
      rowid,
      customer: row.customer ?? '',
      drawingNo: row.drawingNo ?? '',
      productName: row.productName ?? '',
      note: row.note ?? '',
      nestNo: row.nestNo ?? '',
      weightPerPcG: row.weightPerPcG ?? '',
      material: row.material ?? '',
      surface: row.surface ?? '',
      cycleTime: row.cycleTime ?? '',
      postworkTime: row.postworkTime ?? '',
      postworks: row.postworks ?? '',
      boxSize: row.boxSize ?? '',
      boxPer: row.boxPer ?? '',
      boxPerPallet: row.boxPerPallet ?? '',
      articleNo: row.articleNo ?? '',
      warehouse: row.warehouse ?? '',
      ingotWeight: row.ingotWeight ?? '',
    })
    setEditDialog(true)
  }

  const hideEditDialog = () => {
    setEditDialog(false)
    setEditSubmitted(false)
    setEditItem(null)
  }

  const saveEditItem = async () => {
    setEditSubmitted(true)
    if (!db) return
    if (!editItem) return
    if (!String(editItem.customer ?? '').trim()) return
    if (!String(editItem.drawingNo ?? '').trim()) return

    const id = editItem.rowid
    if (!id) return

    const before = itemsLocal.find(it => (it.rowid ?? it.id) === id)
    if (before) setLastAction({ type: 'edit', rowid: id, before: { ...before } })

    const patch = {
      customer: editItem.customer,
      drawingNo: editItem.drawingNo,
      productName: editItem.productName,
      note: editItem.note,
      nestNo: editItem.nestNo,
      weightPerPcG: editItem.weightPerPcG,
      material: editItem.material,
      surface: editItem.surface,
      cycleTime: editItem.cycleTime,
      postworkTime: editItem.postworkTime,
      postworks: editItem.postworks,
      boxSize: editItem.boxSize,
      boxPer: editItem.boxPer,
      boxPerPallet: editItem.boxPerPallet,
      articleNo: editItem.articleNo,
      warehouse: editItem.warehouse,
      ingotWeight: editItem.ingotWeight,
    }

    setItemsLocal(prev => prev.map(it => ((it.rowid ?? it.id) === id ? { ...it, ...patch } : it)))

    try {
      updateItemFields(db, id, patch)
      await persistDb(db)
      setEditDialog(false)
      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  // ----------------
  // Clear selection / Delete / Undo
  // ----------------
  const clearSelection = () => setSelectedItems([])

  const confirmDeleteSelected = () => {
    if (!selectedItems?.length) return

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
    if (!selectedItems?.length) return

    const ids = selectedItems.map(r => r.rowid ?? r.id)

    setLastAction({ type: 'delete', rows: selectedItems.map(r => ({ ...r })) })

    setItemsLocal(prev => prev.filter(it => !ids.includes(it.rowid ?? it.id)))
    setSelectedItems([])

    try {
      deleteItems(db, ids)
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
          createItem(db, {
            customer: r.customer,
            drawingNo: r.drawingNo,
            productName: r.productName,
            note: r.note,
            nestNo: r.nestNo,
            weightPerPcG: r.weightPerPcG,
            material: r.material,
            surface: r.surface,
            cycleTime: r.cycleTime,
            postworkTime: r.postworkTime,
            postworks: r.postworks,
            boxSize: r.boxSize,
            boxPer: r.boxPer,
            boxPerPallet: r.boxPerPallet,
            articleNo: r.articleNo,
            warehouse: r.warehouse,
            ingotWeight: r.ingotWeight,
          })
        }
        await persistDb(db)
        setLastAction(null)
        if (onSaved) await onSaved()
        return
      }

      if (lastAction.type === 'edit') {
        const b = lastAction.before
        updateItemFields(db, lastAction.rowid, {
          customer: b.customer ?? '',
          drawingNo: b.drawingNo ?? '',
          productName: b.productName ?? '',
          note: b.note ?? '',
          nestNo: b.nestNo ?? '',
          weightPerPcG: b.weightPerPcG ?? '',
          material: b.material ?? '',
          surface: b.surface ?? '',
          cycleTime: b.cycleTime ?? '',
          postworkTime: b.postworkTime ?? '',
          postworks: b.postworks ?? '',
          boxSize: b.boxSize ?? '',
          boxPer: b.boxPer ?? '',
          boxPerPallet: b.boxPerPallet ?? '',
          articleNo: b.articleNo ?? '',
          warehouse: b.warehouse ?? '',
          ingotWeight: b.ingotWeight ?? '',
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

  // ----------------
  // Toolbar
  // ----------------
  const leftToolbarTemplate = () => (
    <div className="flex flex-wrap gap-2">
      <Button label="New" icon="pi pi-plus" severity="success" onClick={openNew} type="button" />
    </div>
  )

  const rightToolbarTemplate = () => (
    <div className="flex flex-wrap gap-2 justify-content-end">
      <Button
        label="Undo"
        icon="pi pi-undo"
        severity="secondary"
        onClick={undoLastAction}
        type="button"
        disabled={!lastAction}
      />
      <Button
        label="Clear selection"
        icon="pi pi-times"
        severity="secondary"
        onClick={clearSelection}
        type="button"
        disabled={!selectedItems?.length}
      />
      <Button
        label="Delete"
        icon="pi pi-trash"
        severity="danger"
        onClick={confirmDeleteSelected}
        type="button"
        disabled={!selectedItems?.length}
      />
      <Button
        label="Edit selected"
        icon="pi pi-pencil"
        severity="info"
        onClick={openEditSelected}
        type="button"
        disabled={!selectedItems?.length || selectedItems.length !== 1}
      />
    </div>
  )

  const newDialogFooter = (
    <>
      <Button label="Cancel" icon="pi pi-times" outlined onClick={hideNewDialog} type="button" />
      <Button label="Save" icon="pi pi-check" type="button" onClick={saveNewItem} />
    </>
  )

  const editDialogFooter = (
    <>
      <Button label="Cancel" icon="pi pi-times" outlined onClick={hideEditDialog} type="button" />
      <Button label="Save" icon="pi pi-check" type="button" onClick={saveEditItem} />
    </>
  )

  return (
    <>
      <ConfirmDialog />

      <Toolbar className="mb-3" left={leftToolbarTemplate} right={rightToolbarTemplate} />

      <DataTable
        value={itemsLocal}
        paginator
        rows={20}
        rowsPerPageOptions={[10, 20, 50]}
        loading={loading}
        header={header}
        filters={filters}
        size="small"
        globalFilterFields={[
          'customer',
          'drawingNo',
          'productName',
          'note',
          'nestNo',
          'weightPerPcG',
          'material',
          'surface',
          'cycleTime',
          'postworkTime',
          'postworks',
          'boxSize',
          'boxPer',
          'boxPerPallet',
          'articleNo',
          'warehouse',
          'ingotWeight',
        ]}
        emptyMessage="No items found."
        dataKey="id"
        selectionMode="multiple"
        selection={selectedItems}
        onSelectionChange={(e) => setSelectedItems(e.value)}
        metaKeySelection={metaKey}
        dragSelection
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />

        <Column field="customer" header="Ügyfél" sortable />
        <Column field="drawingNo" header="Termék rajzszáma" sortable />
        <Column field="productName" header="Termék megnevezés" sortable />
        <Column field="note" header="Megjegyzés" />
        <Column field="nestNo" header="Fészekszáma" sortable />
        <Column field="weightPerPcG" header="Súly/db g" sortable />
        <Column field="material" header="Anyag" sortable />
        <Column field="surface" header="Felületkezelés" sortable />
        <Column field="cycleTime" header="Ciklus idő" sortable />
        <Column field="postworkTime" header="Utómunka idő" sortable />
        <Column field="postworks" header="Utómunkák" />
        <Column field="boxSize" header="Doboz méret" sortable />
        <Column field="boxPer" header="Doboz/db" sortable />
        <Column field="boxPerPallet" header="Doboz/Raklap" sortable />
        <Column field="articleNo" header="Arktikál nr." sortable />
        <Column field="warehouse" header="Raktár" sortable />
        <Column field="ingotWeight" header="Engusz súly" sortable />
      </DataTable>

      {/* NEW dialog */}
      <Dialog
        visible={newDialog}
        style={{ width: '60rem' }}
        header="New Item"
        modal
        className="p-fluid"
        footer={newDialogFooter}
        onHide={hideNewDialog}
      >
        <div className="formgrid grid">
          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Ügyfél</label>
            <InputText value={newItem.customer} onChange={(e) => setNewItem(p => ({ ...p, customer: e.target.value }))} />
            {newSubmitted && !String(newItem.customer ?? '').trim() && <small className="p-error">Ügyfél kötelező.</small>}
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Termék rajzszáma</label>
            <InputText value={newItem.drawingNo} onChange={(e) => setNewItem(p => ({ ...p, drawingNo: e.target.value }))} />
            {newSubmitted && !String(newItem.drawingNo ?? '').trim() && <small className="p-error">Rajzszám kötelező.</small>}
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Termék megnevezés</label>
            <InputText value={newItem.productName} onChange={(e) => setNewItem(p => ({ ...p, productName: e.target.value }))} />
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Megjegyzés</label>
            <InputTextarea value={newItem.note} onChange={(e) => setNewItem(p => ({ ...p, note: e.target.value }))} rows={3} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Fészekszáma</label>
            <InputText value={newItem.nestNo} onChange={(e) => setNewItem(p => ({ ...p, nestNo: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Súly/db g</label>
            <InputText value={newItem.weightPerPcG} onChange={(e) => setNewItem(p => ({ ...p, weightPerPcG: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Anyag</label>
            <InputText value={newItem.material} onChange={(e) => setNewItem(p => ({ ...p, material: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Felületkezelés</label>
            <InputText value={newItem.surface} onChange={(e) => setNewItem(p => ({ ...p, surface: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Ciklus idő</label>
            <InputText value={newItem.cycleTime} onChange={(e) => setNewItem(p => ({ ...p, cycleTime: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Utómunka idő</label>
            <InputText value={newItem.postworkTime} onChange={(e) => setNewItem(p => ({ ...p, postworkTime: e.target.value }))} />
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Utómunkák</label>
            <InputTextarea value={newItem.postworks} onChange={(e) => setNewItem(p => ({ ...p, postworks: e.target.value }))} rows={2} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Doboz méret</label>
            <InputText value={newItem.boxSize} onChange={(e) => setNewItem(p => ({ ...p, boxSize: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Doboz/db</label>
            <InputText value={newItem.boxPer} onChange={(e) => setNewItem(p => ({ ...p, boxPer: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Doboz/Raklap</label>
            <InputText value={newItem.boxPerPallet} onChange={(e) => setNewItem(p => ({ ...p, boxPerPallet: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Arktikál nr.</label>
            <InputText value={newItem.articleNo} onChange={(e) => setNewItem(p => ({ ...p, articleNo: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Raktár</label>
            <InputText value={newItem.warehouse} onChange={(e) => setNewItem(p => ({ ...p, warehouse: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-4">
            <label className="font-bold mb-2 block">Engusz súly</label>
            <InputText value={newItem.ingotWeight} onChange={(e) => setNewItem(p => ({ ...p, ingotWeight: e.target.value }))} />
          </div>
        </div>
      </Dialog>

      {/* EDIT dialog */}
      <Dialog
        visible={editDialog}
        style={{ width: '60rem' }}
        header="Edit selected item"
        modal
        className="p-fluid"
        footer={editDialogFooter}
        onHide={hideEditDialog}
      >
        {!editItem ? null : (
          <div className="formgrid grid">
            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Ügyfél</label>
              <InputText value={editItem.customer} onChange={(e) => setEditItem(p => ({ ...p, customer: e.target.value }))} />
              {editSubmitted && !String(editItem.customer ?? '').trim() && <small className="p-error">Ügyfél kötelező.</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Termék rajzszáma</label>
              <InputText value={editItem.drawingNo} onChange={(e) => setEditItem(p => ({ ...p, drawingNo: e.target.value }))} />
              {editSubmitted && !String(editItem.drawingNo ?? '').trim() && <small className="p-error">Rajzszám kötelező.</small>}
            </div>

            <div className="field col-12">
              <label className="font-bold mb-2 block">Termék megnevezés</label>
              <InputText value={editItem.productName} onChange={(e) => setEditItem(p => ({ ...p, productName: e.target.value }))} />
            </div>

            <div className="field col-12">
              <label className="font-bold mb-2 block">Megjegyzés</label>
              <InputTextarea value={editItem.note} onChange={(e) => setEditItem(p => ({ ...p, note: e.target.value }))} rows={3} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Fészekszáma</label>
              <InputText value={editItem.nestNo} onChange={(e) => setEditItem(p => ({ ...p, nestNo: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Súly/db g</label>
              <InputText value={editItem.weightPerPcG} onChange={(e) => setEditItem(p => ({ ...p, weightPerPcG: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Anyag</label>
              <InputText value={editItem.material} onChange={(e) => setEditItem(p => ({ ...p, material: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Felületkezelés</label>
              <InputText value={editItem.surface} onChange={(e) => setEditItem(p => ({ ...p, surface: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Ciklus idő</label>
              <InputText value={editItem.cycleTime} onChange={(e) => setEditItem(p => ({ ...p, cycleTime: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Utómunka idő</label>
              <InputText value={editItem.postworkTime} onChange={(e) => setEditItem(p => ({ ...p, postworkTime: e.target.value }))} />
            </div>

            <div className="field col-12">
              <label className="font-bold mb-2 block">Utómunkák</label>
              <InputTextarea value={editItem.postworks} onChange={(e) => setEditItem(p => ({ ...p, postworks: e.target.value }))} rows={2} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Doboz méret</label>
              <InputText value={editItem.boxSize} onChange={(e) => setEditItem(p => ({ ...p, boxSize: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Doboz/db</label>
              <InputText value={editItem.boxPer} onChange={(e) => setEditItem(p => ({ ...p, boxPer: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Doboz/Raklap</label>
              <InputText value={editItem.boxPerPallet} onChange={(e) => setEditItem(p => ({ ...p, boxPerPallet: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Arktikál nr.</label>
              <InputText value={editItem.articleNo} onChange={(e) => setEditItem(p => ({ ...p, articleNo: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Raktár</label>
              <InputText value={editItem.warehouse} onChange={(e) => setEditItem(p => ({ ...p, warehouse: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-4">
              <label className="font-bold mb-2 block">Engusz súly</label>
              <InputText value={editItem.ingotWeight} onChange={(e) => setEditItem(p => ({ ...p, ingotWeight: e.target.value }))} />
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}