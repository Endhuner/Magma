// Using XLSX and Blob to write to a file
function downloadXlsx(data, fileName) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const writeOptions = {
        bookType: 'xlsx',
        type: 'binary',
    };

    const wbout = XLSX.write(wb, writeOptions);
    const blob = new Blob([s2ab(wbout)], {type: 'application/octet-stream'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xFF;
    }
    return buf;
}
