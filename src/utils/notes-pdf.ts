import jsPDF from 'jspdf';

interface RateationNote {
  id: number;
  number: string | null;
  taxpayer_name: string | null;
  total_amount: number | null;
  notes: string;
  updated_at: string;
  rateation_types?: { name: string } | null;
}

export function generateSingleNotePDF(rateation: RateationNote) {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTA RATEAZIONE', 20, yPos);
  yPos += 15;
  
  // Separator line
  doc.setLineWidth(0.5);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;
  
  // Rateation details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (rateation.number) {
    doc.setFont('helvetica', 'bold');
    doc.text('Numero:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(rateation.number, 50, yPos);
    yPos += 7;
  }
  
  if (rateation.rateation_types?.name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(rateation.rateation_types.name, 50, yPos);
    yPos += 7;
  }
  
  if (rateation.taxpayer_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Contribuente:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(rateation.taxpayer_name, 50, yPos);
    yPos += 7;
  }
  
  if (rateation.total_amount) {
    doc.setFont('helvetica', 'bold');
    doc.text('Importo totale:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `€${rateation.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      50,
      yPos
    );
    yPos += 10;
  }
  
  // Separator line
  doc.setLineWidth(0.5);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;
  
  // Note content
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Nota:', 20, yPos);
  yPos += 7;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const splitNote = doc.splitTextToSize(rateation.notes, 170);
  doc.text(splitNote, 20, yPos);
  yPos += (splitNote.length * 7);
  
  // Footer with timestamp
  const footerY = 280;
  doc.setLineWidth(0.5);
  doc.line(20, footerY - 10, 190, footerY - 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  
  const formattedDate = new Date(rateation.updated_at).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Ultima modifica: ${formattedDate}`, 20, footerY);
  
  // Download
  const fileName = `Nota_${rateation.number || 'Rateazione'}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  doc.save(fileName);
}

export function generateNotesPDF(notes: RateationNote[]) {
  const doc = new jsPDF();
  const margin = 15;
  let yPos = 20;
  
  // Header principale
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  doc.text(`RIEPILOGO NOTE - ${today}`, margin, yPos);
  yPos += 10;
  
  // Separator dopo header
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, 195, yPos);
  yPos += 10;
  
  // Helper: Format taxpayer codes in 3 vertical columns
  const formatTaxpayerColumns = (taxpayerName: string | null): string[][] => {
    if (!taxpayerName) return [['N/A']];
    
    const codes = taxpayerName.trim().split(/\s+/).filter(c => c.length > 0);
    
    if (codes.length === 1) {
      return [[codes[0]]];
    }
    
    // Multiple codes: distribute in 3 columns (max 4 per column)
    const maxCodes = 12;
    const codesToShow = codes.slice(0, maxCodes);
    
    const column1 = codesToShow.slice(0, 4);
    const column2 = codesToShow.slice(4, 8);
    const column3 = codesToShow.slice(8, 12);
    
    return [column1, column2, column3].filter(col => col.length > 0);
  };
  
  // Render each note
  notes.forEach((note, index) => {
    // Check if we need a new page
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    
    // Note number and header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const headerText = `${index + 1}. ${note.number || 'N/A'} ${note.rateation_types?.name || ''} - `;
    doc.text(headerText, margin, yPos);
    yPos += 6;
    
    // Taxpayer codes (3 columns if multiple)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const taxpayerColumns = formatTaxpayerColumns(note.taxpayer_name);
    
    if (taxpayerColumns.length === 1 && taxpayerColumns[0].length === 1) {
      // Single code: display on same line as header
      yPos -= 6; // Go back to same line
      const headerWidth = doc.getTextWidth(headerText);
      doc.text(taxpayerColumns[0][0], margin + headerWidth, yPos);
      yPos += 6;
    } else {
      // Multiple codes: display in 3 columns below header
      const columnWidth = 60; // Width for each column
      const startX = margin + 3; // Indent slightly
      
      const maxRows = Math.max(...taxpayerColumns.map(col => col.length));
      
      for (let row = 0; row < maxRows; row++) {
        taxpayerColumns.forEach((column, colIndex) => {
          if (row < column.length) {
            const colX = startX + (colIndex * columnWidth);
            doc.text(column[row], colX, yPos);
          }
        });
        yPos += 5;
      }
    }
    
    yPos += 2;
    
    // Note content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nota: ${note.notes}`, margin + 3, yPos, { maxWidth: 180 });
    const noteLines = doc.splitTextToSize(`Nota: ${note.notes}`, 180);
    yPos += (noteLines.length * 5);
    
    yPos += 3;
    
    // Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const formattedDate = new Date(note.updated_at).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Modificata: ${formattedDate}`, margin + 3, yPos);
    yPos += 8;
    
    // Separator
    doc.setLineWidth(0.3);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, yPos, 195, yPos);
    yPos += 8;
  });
  
  // Download
  const fileName = `Riepilogo_Note_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

interface FreeNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function generateFreeNotesPDF(notes: FreeNote[]) {
  const doc = new jsPDF();
  const margin = 15;
  let yPos = 20;
  
  // Header principale
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  doc.text(`RIEPILOGO PROMEMORIA - ${today}`, margin, yPos);
  yPos += 10;
  
  // Separator dopo header
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, 195, yPos);
  yPos += 10;
  
  // Render each note
  notes.forEach((note, index) => {
    // Check if we need a new page
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    
    // Note number and title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${note.title}`, margin, yPos);
    yPos += 7;
    
    // Note content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitContent = doc.splitTextToSize(note.content, 180);
    doc.text(splitContent, margin + 3, yPos);
    yPos += (splitContent.length * 5);
    
    yPos += 3;
    
    // Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const formattedDate = new Date(note.updated_at).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Modificato: ${formattedDate}`, margin + 3, yPos);
    yPos += 8;
    
    // Separator
    doc.setLineWidth(0.3);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, yPos, 195, yPos);
    yPos += 8;
  });
  
  // Download
  const fileName = `Riepilogo_Promemoria_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
