import XLSX from 'xlsx-js-style';

export async function buildCmrWorkbook(selectedOrders) {
    const response = await fetch('/public/Cmr.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    // Fill cells B6, B7, B12, B13
    const ws = wb.Sheets[wb.SheetNames[0]];
    ws['B6'].v = selectedOrders.someField; // replace 'someField' with actual field
    ws['B7'].v = selectedOrders.anotherField; // replace 'anotherField' with actual field
    ws['B12'].v = selectedOrders.yetAnotherField; // replace 'yetAnotherField' with actual field
    ws['B13'].v = selectedOrders.differentField; // replace 'differentField' with actual field

    // Set table rows starting at A16
    for (let i = 0; i < selectedOrders.length; i++) {
        const order = selectedOrders[i];
        const rowIndex = 16 + i; // starting from A16
        ws[`A${rowIndex}`] = { v: order.field1 }; // replace with actual fields
        ws[`B${rowIndex}`] = { v: order.field2 }; // and so on...
    }

    // Set date cells C26, E26, F26
    ws['C26'].v = new Date(); // Set current date as an example
    ws['E26'].v = new Date(); // Set current date as an example
    ws['F26'].v = new Date(); // Set current date as an example

    return { wb, exportId: 'someExportId' }; // Replace with actual exportId if needed
}