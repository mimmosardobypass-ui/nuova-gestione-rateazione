import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface MonthBreakdownExportData {
  year: number;
  month: number;
  monthName: string;
  type: string;
  typeLabel: string;
  paid: Array<{
    number: string;
    taxpayer_name: string;
    amount_cents: number;
  }>;
  unpaid: Array<{
    number: string;
    taxpayer_name: string;
    residual_cents: number;
  }>;
  paidTotal: number;
  unpaidTotal: number;
}

// Funzione helper per formattare euro
function formatEuro(cents: number): string {
  return `€ ${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
}

// Export Excel
export function exportMonthBreakdownToExcel(data: MonthBreakdownExportData): void {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Riepilogo
  const summaryData = [
    ["Dettaglio Mensile - Export"],
    [""],
    ["Periodo", `${data.monthName} ${data.year}`],
    ["Tipologia", data.typeLabel],
    [""],
    ["Riepilogo"],
    ["", "Conteggio", "Importo"],
    ["Rate Pagate", data.paid.length, formatEuro(data.paidTotal)],
    ["Rate Non Pagate", data.unpaid.length, formatEuro(data.unpaidTotal)],
    ["Totale", data.paid.length + data.unpaid.length, formatEuro(data.paidTotal + data.unpaidTotal)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Riepilogo");

  // Sheet 2: Rate Non Pagate
  if (data.unpaid.length > 0) {
    const unpaidData = [
      ["N. Rateazione", "Contribuente", "Residuo"],
      ...data.unpaid.map((r) => [
        r.number,
        r.taxpayer_name || "N/A",
        formatEuro(r.residual_cents),
      ]),
      ["", "TOTALE", formatEuro(data.unpaidTotal)],
    ];
    const unpaidSheet = XLSX.utils.aoa_to_sheet(unpaidData);
    XLSX.utils.book_append_sheet(workbook, unpaidSheet, "Non Pagate");
  }

  // Sheet 3: Rate Pagate
  if (data.paid.length > 0) {
    const paidData = [
      ["N. Rateazione", "Contribuente", "Importo"],
      ...data.paid.map((r) => [
        r.number,
        r.taxpayer_name || "N/A",
        formatEuro(r.amount_cents),
      ]),
      ["", "TOTALE", formatEuro(data.paidTotal)],
    ];
    const paidSheet = XLSX.utils.aoa_to_sheet(paidData);
    XLSX.utils.book_append_sheet(workbook, paidSheet, "Pagate");
  }

  const filename = `dettaglio_${data.type}_${data.monthName}_${data.year}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// Export PDF
export function exportMonthBreakdownToPDF(data: MonthBreakdownExportData): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text("Dettaglio Mensile", 14, 20);

  doc.setFontSize(12);
  doc.text(`${data.monthName} ${data.year} — ${data.typeLabel}`, 14, 28);
  
  doc.setFontSize(10);
  doc.text(`Generato il: ${new Date().toLocaleString("it-IT")}`, 14, 35);

  // Summary Table
  doc.setFontSize(14);
  doc.text("Riepilogo", 14, 45);

  autoTable(doc, {
    startY: 50,
    head: [["", "Conteggio", "Importo"]],
    body: [
      ["Rate Pagate", data.paid.length, formatEuro(data.paidTotal)],
      ["Rate Non Pagate", data.unpaid.length, formatEuro(data.unpaidTotal)],
      ["Totale", data.paid.length + data.unpaid.length, formatEuro(data.paidTotal + data.unpaidTotal)],
    ],
  });

  // Unpaid Table
  if (data.unpaid.length > 0) {
    const finalY1 = (doc as any).lastAutoTable.finalY || 80;
    
    if (finalY1 > 240) doc.addPage();
    
    const startY1 = finalY1 > 240 ? 20 : finalY1 + 10;
    doc.setFontSize(14);
    doc.text("Rate Non Pagate", 14, startY1);

    autoTable(doc, {
      startY: startY1 + 5,
      head: [["N. Rateazione", "Contribuente", "Residuo"]],
      body: data.unpaid.map((r) => [
        r.number,
        r.taxpayer_name || "N/A",
        formatEuro(r.residual_cents),
      ]),
      foot: [["", "TOTALE", formatEuro(data.unpaidTotal)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [239, 68, 68] }, // red-500
    });
  }

  // Paid Table
  if (data.paid.length > 0) {
    const finalY2 = (doc as any).lastAutoTable.finalY || 120;
    
    if (finalY2 > 240) doc.addPage();
    
    const startY2 = finalY2 > 240 ? 20 : finalY2 + 10;
    doc.setFontSize(14);
    doc.text("Rate Pagate", 14, startY2);

    autoTable(doc, {
      startY: startY2 + 5,
      head: [["N. Rateazione", "Contribuente", "Importo"]],
      body: data.paid.map((r) => [
        r.number,
        r.taxpayer_name || "N/A",
        formatEuro(r.amount_cents),
      ]),
      foot: [["", "TOTALE", formatEuro(data.paidTotal)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] }, // green-500
    });
  }

  const filename = `dettaglio_${data.type}_${data.monthName}_${data.year}.pdf`;
  doc.save(filename);
}

// Print (apre finestra di stampa del browser)
export function printMonthBreakdown(data: MonthBreakdownExportData): void {
  // Crea una finestra temporanea con il contenuto da stampare
  const printWindow = window.open("", "_blank");
  
  if (!printWindow) {
    alert("Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.");
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dettaglio ${data.typeLabel} - ${data.monthName} ${data.year}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          font-size: 12px;
        }
        h1 { font-size: 20px; margin-bottom: 5px; }
        h2 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
        h3 { font-size: 14px; margin-top: 15px; margin-bottom: 8px; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        .text-right { text-align: right; }
        .summary-table { width: 50%; }
        .total-row {
          font-weight: bold;
          background-color: #f9fafb;
        }
        .unpaid-header { background-color: #fee2e2; }
        .paid-header { background-color: #d1fae5; }
        @media print {
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>Dettaglio Mensile</h1>
      <p><strong>${data.monthName} ${data.year}</strong> — ${data.typeLabel}</p>
      <p style="font-size: 10px; color: #666;">Generato il: ${new Date().toLocaleString("it-IT")}</p>

      <h2>Riepilogo</h2>
      <table class="summary-table">
        <thead>
          <tr>
            <th></th>
            <th class="text-right">Conteggio</th>
            <th class="text-right">Importo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Rate Pagate</td>
            <td class="text-right">${data.paid.length}</td>
            <td class="text-right">${formatEuro(data.paidTotal)}</td>
          </tr>
          <tr>
            <td>Rate Non Pagate</td>
            <td class="text-right">${data.unpaid.length}</td>
            <td class="text-right">${formatEuro(data.unpaidTotal)}</td>
          </tr>
          <tr class="total-row">
            <td>Totale</td>
            <td class="text-right">${data.paid.length + data.unpaid.length}</td>
            <td class="text-right">${formatEuro(data.paidTotal + data.unpaidTotal)}</td>
          </tr>
        </tbody>
      </table>

      ${data.unpaid.length > 0 ? `
        <h3>🔴 Rate Non Pagate (${data.unpaid.length})</h3>
        <table>
          <thead>
            <tr class="unpaid-header">
              <th>N. Rateazione</th>
              <th>Contribuente</th>
              <th class="text-right">Residuo</th>
            </tr>
          </thead>
          <tbody>
            ${data.unpaid.map(r => `
              <tr>
                <td>${r.number}</td>
                <td>${r.taxpayer_name || "N/A"}</td>
                <td class="text-right">${formatEuro(r.residual_cents)}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="2">TOTALE</td>
              <td class="text-right">${formatEuro(data.unpaidTotal)}</td>
            </tr>
          </tbody>
        </table>
      ` : ""}

      ${data.paid.length > 0 ? `
        <h3>🟢 Rate Pagate (${data.paid.length})</h3>
        <table>
          <thead>
            <tr class="paid-header">
              <th>N. Rateazione</th>
              <th>Contribuente</th>
              <th class="text-right">Importo</th>
            </tr>
          </thead>
          <tbody>
            ${data.paid.map(r => `
              <tr>
                <td>${r.number}</td>
                <td>${r.taxpayer_name || "N/A"}</td>
                <td class="text-right">${formatEuro(r.amount_cents)}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="2">TOTALE</td>
              <td class="text-right">${formatEuro(data.paidTotal)}</td>
            </tr>
          </tbody>
        </table>
      ` : ""}

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
