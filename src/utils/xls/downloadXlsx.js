// Implementation of xlsx-js-style

import { writeFile } from 'xlsx-js-style';

export const downloadWorkbookXlsx = (workbook) => {
    const wbout = writeFile(workbook, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([new Uint8Array(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbook.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};