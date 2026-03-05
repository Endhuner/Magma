// src/components/CustomersTable.jsx
// Kiegészítések:
// - "Clear selection" gomb (kijelölések megszüntetése) az Edit selected elé
// - "Delete" piros gomb (kijelölt tételek törlése) megerősítő ablakkal (Yes/No)
// - "Undo" gomb: az utolsó művelet visszavonása (delete vagy edit vagy new) egyszerű snapshot-alapon
//
// Fontos: a törléshez kell a customerService.deleteCustomers(db, rowids) függvény (lentebb külön fájl blokkban).
// A visszavonás (Undo) úgy működik, hogy a művelet előtt elmentjük a teljes "vevok" tábla exportját (db.export()).
// Undo esetén ezt visszatöltjük ugyanabba a db objektumba (db.close + új SQL.Database), majd persistDb + onSaved.
// Ehhez CustomersTable kap egy új propot: SQL (sql.js modul) VAGY egyszerűbb: App-ben adjunk egy `reloadDbFromBytes` callbacket.
// Mivel nálad a db-t az App hozza létre, itt a legbiztosabb: CustomersTable kapjon `onUndoRestore(bytes)` callbacket.
// Ha ezt nem akarod, szólj és átalakítom App oldali megoldásra.
//
// JELEN VERZIÓ: egyszerűbb "adat-szintű undo" (nem teljes DB):
// - törlés előtt elmentjük a törölt sorok teljes adatait (selectedCustomers)
// - edit előtt elmentjük az eredeti sort (1 db)
// - new előtt nincs undo (opcionálisan megoldható)
// - undo delete: visszaszúrja a sorokat (createCustomerFromRowid nélkül rowid nem tartható, de a mezők visszajönnek)
// - undo edit: visszaírja az előző mezőket updateCustomerFields-szel
//
// Ha neked KRITIKUS, hogy a törölt sor ugyanazzal a rowid-val jöjjön vissza, akkor DB-szintű snapshot kell.

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
import { createCustomer, updateCustomerFields, deleteCustomers } from '../services/customerService.js'

export function CustomersTable({ customers, loading, db, onSaved }) {
  const [customersLocal, setCustomersLocal] = useState([])
  useEffect(() => {
    setCustomersLocal(Array.isArray(customers) ? customers : [])
  }, [customers])

  // global filter
  const [globalFilterValue, setGlobalFilterValue] = useState('')
  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  })

  // selection
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const metaKey = true

  // NEW dialog
  const [newDialog, setNewDialog] = useState(false)
  const [newSubmitted, setNewSubmitted] = useState(false)
  const emptyNewCustomer = useMemo(() => ({
    name1: '',
    language: '',
    city: '',
    zip: '',
    street: '',
    country: '',
    address: '',
    taxNumber: '',
    name2: '',
  }), [])
  const [newCustomer, setNewCustomer] = useState(emptyNewCustomer)

  // EDIT dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editSubmitted, setEditSubmitted] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)

  // UNDO: utolsó művelet
  // { type: 'delete', rows: CustomerRow[] } | { type: 'edit', before: CustomerRow, rowid: number } | { type: 'new', row: CustomerRow }
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
          placeholder="Keresés (név / város / ország / adószám...)"
        />
      </span>
      <div className="text-sm text-600">{customersLocal?.length ?? 0} vevő</div>
    </div>
  ), [globalFilterValue, customersLocal])

  // ----------------
  // Actions
  // ----------------
  const openNew = () => {
    setNewSubmitted(false)
    setNewCustomer(emptyNewCustomer)
    setNewDialog(true)
  }

  const hideNewDialog = () => {
    setNewDialog(false)
    setNewSubmitted(false)
  }

  const saveNewCustomer = async () => {
    setNewSubmitted(true)
    if (!db) return
    if (!String(newCustomer.name1 ?? '').trim()) return

    try {
      createCustomer(db, newCustomer)
      await persistDb(db)
      setNewDialog(false)

      // Undo: (korlátozott) új vevő visszavonása = törlés azonos mezőkkel (rowid nélkül nehéz pontosan)
      // Itt inkább nem állítunk be lastAction-t, vagy csak jelzünk. Most: beállítjuk 'new'-ra a mezőkkel.
      setLastAction({ type: 'new', row: { ...newCustomer } })

      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const openEditSelected = () => {
    setEditSubmitted(false)
    if (!selectedCustomers?.length) return
    if (selectedCustomers.length !== 1) return

    const row = selectedCustomers[0]
    setEditCustomer({
      rowid: row.id,
      name1: row.name1 ?? '',
      language: row.language ?? '',
      city: row.city ?? '',
      zip: row.zip ?? '',
      street: row.street ?? '',
      country: row.country ?? '',
      address: row.address ?? '',
      taxNumber: row.taxNumber ?? '',
      name2: row.name2 ?? '',
    })
    setEditDialog(true)
  }

  const hideEditDialog = () => {
    setEditDialog(false)
    setEditSubmitted(false)
    setEditCustomer(null)
  }

  const saveEditCustomer = async () => {
    setEditSubmitted(true)
    if (!db) return
    if (!editCustomer) return
    if (!String(editCustomer.name1 ?? '').trim()) return

    const id = editCustomer.rowid

    // Undo: mentsük el a "before" állapotot
    const before = customersLocal.find(c => c.id === id)
    if (before) setLastAction({ type: 'edit', rowid: id, before: { ...before } })

    const patch = {
      name1: editCustomer.name1,
      language: editCustomer.language,
      city: editCustomer.city,
      zip: editCustomer.zip,
      street: editCustomer.street,
      country: editCustomer.country,
      address: editCustomer.address,
      taxNumber: editCustomer.taxNumber,
      name2: editCustomer.name2,
    }

    setCustomersLocal(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))

    try {
      updateCustomerFields(db, id, patch)
      await persistDb(db)
      setEditDialog(false)
      if (onSaved) await onSaved()
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  const clearSelection = () => {
    setSelectedCustomers([])
  }

  const confirmDeleteSelected = () => {
    if (!selectedCustomers?.length) return

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
    if (!selectedCustomers?.length) return

    const ids = selectedCustomers.map(r => r.id)

    // Undo: törlés előtti sorok mentése
    setLastAction({ type: 'delete', rows: selectedCustomers.map(r => ({ ...r })) })

    // UI: azonnal kivesszük
    setCustomersLocal(prev => prev.filter(c => !ids.includes(c.id)))
    setSelectedCustomers([])

    try {
      deleteCustomers(db, ids)
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
        // visszaszúrjuk (rowid nem lesz ugyanaz)
        for (const r of lastAction.rows) {
          createCustomer(db, {
            name1: r.name1,
            language: r.language,
            city: r.city,
            zip: r.zip,
            street: r.street,
            country: r.country,
            address: r.address,
            taxNumber: r.taxNumber,
            name2: r.name2,
          })
        }
        await persistDb(db)
        setLastAction(null)
        if (onSaved) await onSaved()
        return
      }

      if (lastAction.type === 'edit') {
        updateCustomerFields(db, lastAction.rowid, {
          name1: lastAction.before.name1,
          language: lastAction.before.language,
          city: lastAction.before.city,
          zip: lastAction.before.zip,
          street: lastAction.before.street,
          country: lastAction.before.country,
          address: lastAction.before.address,
          taxNumber: lastAction.before.taxNumber,
          name2: lastAction.before.name2,
        })
        await persistDb(db)
        setLastAction(null)
        if (onSaved) await onSaved()
        return
      }

      if (lastAction.type === 'new') {
        // "new" undo: nem tudjuk biztosan azonosítani a frissen felvett rowid-t,
        // ezért ezt most nem csináljuk automatikusan.
        alert('A "New" visszavonás ebben a verzióban nem támogatott biztosan (rowid hiány).')
        return
      }
    } catch (err) {
      console.error(err)
      alert(err?.message || String(err))
    }
  }

  // toolbar templates
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
        disabled={!selectedCustomers?.length}
      />
      <Button
        label="Delete"
        icon="pi pi-trash"
        severity="danger"
        onClick={confirmDeleteSelected}
        type="button"
        disabled={!selectedCustomers?.length}
      />
      <Button
        label="Edit selected"
        icon="pi pi-pencil"
        severity="info"
        onClick={openEditSelected}
        type="button"
        disabled={!selectedCustomers?.length || selectedCustomers.length !== 1}
      />
    </div>
  )

  const newDialogFooter = (
    <>
      <Button label="Cancel" icon="pi pi-times" outlined onClick={hideNewDialog} type="button" />
      <Button label="Save" icon="pi pi-check" type="button" onClick={saveNewCustomer} />
    </>
  )

  const editDialogFooter = (
    <>
      <Button label="Cancel" icon="pi pi-times" outlined onClick={hideEditDialog} type="button" />
      <Button label="Save" icon="pi pi-check" type="button" onClick={saveEditCustomer} />
    </>
  )

  return (
    <>
      {/* PrimeReact ConfirmDialog "host" */}
      <ConfirmDialog />

      <Toolbar className="mb-3" left={leftToolbarTemplate} right={rightToolbarTemplate} />

      <DataTable
        value={customersLocal}
        paginator
        rows={20}
        rowsPerPageOptions={[10, 20, 50]}
        loading={loading}
        header={header}
        filters={filters}
        size="small"
        globalFilterFields={[
          'name1',
          'language',
          'city',
          'zip',
          'street',
          'country',
          'address',
          'taxNumber',
          'name2',
        ]}
        emptyMessage="No customers found."
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        dataKey="id"
        selectionMode="multiple"
        selection={selectedCustomers}
        onSelectionChange={(e) => setSelectedCustomers(e.value)}
        metaKeySelection={metaKey}
        dragSelection
      >
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />

        <Column field="name1" header="Vevő név" sortable />
        <Column field="language" header="Szállító Nyelve" sortable />
        <Column field="city" header="Város" sortable />
        <Column field="zip" header="Irányítószám" sortable />
        <Column field="street" header="Utca, házszám" sortable />
        <Column field="country" header="Ország" sortable />
        <Column field="address" header="Cím" sortable />
        <Column field="taxNumber" header="Adószám" sortable />
        <Column field="name2" header="Vevő név2" sortable />
      </DataTable>

      {/* NEW dialog */}
      <Dialog
        visible={newDialog}
        style={{ width: '46rem' }}
        header="New Customer"
        modal
        className="p-fluid"
        footer={newDialogFooter}
        onHide={hideNewDialog}
      >
        <div className="formgrid grid">
          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Vevő név</label>
            <InputText value={newCustomer.name1} onChange={(e) => setNewCustomer(p => ({ ...p, name1: e.target.value }))} />
            {newSubmitted && !String(newCustomer.name1 ?? '').trim() && <small className="p-error">Vevő név kötelező.</small>}
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Szállító Nyelve</label>
            <InputText value={newCustomer.language} onChange={(e) => setNewCustomer(p => ({ ...p, language: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Város</label>
            <InputText value={newCustomer.city} onChange={(e) => setNewCustomer(p => ({ ...p, city: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Irányítószám</label>
            <InputText value={newCustomer.zip} onChange={(e) => setNewCustomer(p => ({ ...p, zip: e.target.value }))} />
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Utca, házszám</label>
            <InputText value={newCustomer.street} onChange={(e) => setNewCustomer(p => ({ ...p, street: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Ország</label>
            <InputText value={newCustomer.country} onChange={(e) => setNewCustomer(p => ({ ...p, country: e.target.value }))} />
          </div>

          <div className="field col-12 md:col-6">
            <label className="font-bold mb-2 block">Adószám</label>
            <InputText value={newCustomer.taxNumber} onChange={(e) => setNewCustomer(p => ({ ...p, taxNumber: e.target.value }))} />
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Cím</label>
            <InputTextarea value={newCustomer.address} onChange={(e) => setNewCustomer(p => ({ ...p, address: e.target.value }))} rows={3} />
          </div>

          <div className="field col-12">
            <label className="font-bold mb-2 block">Vevő név2</label>
            <InputText value={newCustomer.name2} onChange={(e) => setNewCustomer(p => ({ ...p, name2: e.target.value }))} />
          </div>
        </div>
      </Dialog>

      {/* EDIT dialog */}
      <Dialog
        visible={editDialog}
        style={{ width: '46rem' }}
        header="Edit selected customer"
        modal
        className="p-fluid"
        footer={editDialogFooter}
        onHide={hideEditDialog}
      >
        {!editCustomer ? null : (
          <div className="formgrid grid">
            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Vevő név</label>
              <InputText value={editCustomer.name1} onChange={(e) => setEditCustomer(p => ({ ...p, name1: e.target.value }))} />
              {editSubmitted && !String(editCustomer.name1 ?? '').trim() && <small className="p-error">Vevő név kötelező.</small>}
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Szállító Nyelve</label>
              <InputText value={editCustomer.language} onChange={(e) => setEditCustomer(p => ({ ...p, language: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Város</label>
              <InputText value={editCustomer.city} onChange={(e) => setEditCustomer(p => ({ ...p, city: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Irányítószám</label>
              <InputText value={editCustomer.zip} onChange={(e) => setEditCustomer(p => ({ ...p, zip: e.target.value }))} />
            </div>

            <div className="field col-12">
              <label className="font-bold mb-2 block">Utca, házszám</label>
              <InputText value={editCustomer.street} onChange={(e) => setEditCustomer(p => ({ ...p, street: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Ország</label>
              <InputText value={editCustomer.country} onChange={(e) => setEditCustomer(p => ({ ...p, country: e.target.value }))} />
            </div>

            <div className="field col-12 md:col-6">
              <label className="font-bold mb-2 block">Adószám</label>
              <InputText value={editCustomer.taxNumber} onChange={(e) => setEditCustomer(p => ({ ...p, taxNumber: e.target.value }))} />
            </div>

            <div className="field col-12">
              <label className="font-bold mb-2 block">Cím</label>
              <InputTextarea value={editCustomer.address} onChange={(e) => setEditCustomer(p => ({ ...p, address: e.target.value }))} rows={3} />
            </div>

            <div className="field col-12">
              <label className="font-bold mb-2 block">Vevő név2</label>
              <InputText value={editCustomer.name2} onChange={(e) => setEditCustomer(p => ({ ...p, name2: e.target.value }))} />
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}