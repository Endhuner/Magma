import React from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import downloadXlsx from '../downloadXlsx';

const OrdersTable = ({ orders }) => {
    const exportToExcel = () => {
        downloadXlsx(orders);
    };

    return (
        <div>
            <Button label="Export to Excel" icon="pi pi-upload" onClick={exportToExcel} />
            <DataTable value={orders}>
                <Column field="orderNumber" header="Order Number" />
                <Column field="customerName" header="Customer Name" />
                <Column field="date" header="Date" />
            </DataTable>
        </div>
    );
};

export default OrdersTable;