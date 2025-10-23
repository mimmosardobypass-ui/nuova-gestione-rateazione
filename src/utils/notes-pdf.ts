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
  
  // Configurazione layout 4×3 ultra-compatto
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 8;
  const headerHeight = 15;
  const usableWidth = pageWidth - (margin * 2);
  const usableHeight = pageHeight - headerHeight - margin;
  
  const cols = 3;
  const rows = 4;
  const colGap = 3;
  const rowGap = 3;
  
  const boxWidth = (usableWidth - (colGap * (cols - 1))) / cols;
  const boxHeight = (usableHeight - (rowGap * (rows - 1))) / rows;
  
  let currentPage = 0;
  let currentIndex = 0;
  
  const notesPerPage = rows * cols; // 12 notes per page
  const totalPages = Math.ceil(notes.length / notesPerPage);
  
  // Helper: Format taxpayer name with multiple references
  const formatTaxpayer = (taxpayerName: string | null): string => {
    if (!taxpayerName) return 'N/A';
    
    const codes = taxpayerName.trim().split(/\s+/).filter(c => c.length > 0);
    
    if (codes.length === 1) {
      return codes[0].length > 20 ? codes[0].substring(0, 17) + '...' : codes[0];
    }
    
    // Multiple codes: show first truncated + counter
    const firstCode = codes[0].substring(0, 12);
    return `${firstCode}... +${codes.length - 1} altri`;
  };
  
  // Generate pages
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    
    // Header compatto
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RIEPILOGO NOTE', margin, 10);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString('it-IT');
    doc.text(today, pageWidth - margin - 20, 10);
    doc.text(`Pag. ${page + 1}/${totalPages}`, pageWidth - margin - 20, 13);
    
    // Separator
    doc.setLineWidth(0.2);
    doc.line(margin, headerHeight - 2, pageWidth - margin, headerHeight - 2);
    
    // Draw grid
    const startY = headerHeight;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const noteIndex = page * notesPerPage + (row * cols) + col;
        
        if (noteIndex >= notes.length) break;
        
        const note = notes[noteIndex];
        const xPos = margin + (col * (boxWidth + colGap));
        const yPos = startY + (row * (boxHeight + rowGap));
        
        // Box border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.rect(xPos, yPos, boxWidth, boxHeight);
        
        let lineY = yPos + 4;
        const padding = 2;
        
        // Line 1: Number + Type
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const numberText = note.number || 'N/A';
        const typeText = note.rateation_types?.name || '';
        const headerText = typeText ? `${numberText} ${typeText}` : numberText;
        const truncatedHeader = headerText.length > 25 
          ? headerText.substring(0, 22) + '...' 
          : headerText;
        doc.text(truncatedHeader, xPos + padding, lineY);
        lineY += 4;
        
        // Line 2: Taxpayer (compact)
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        const taxpayerText = formatTaxpayer(note.taxpayer_name);
        doc.text(taxpayerText, xPos + padding, lineY);
        lineY += 4;
        
        // Lines 3-5: Note content (max 3 lines)
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const noteText = note.notes.length > 100 
          ? note.notes.substring(0, 97) + '...'
          : note.notes;
        const splitNote = doc.splitTextToSize(noteText, boxWidth - (padding * 2));
        const maxNoteLines = 3;
        const noteLinestoShow = splitNote.slice(0, maxNoteLines);
        doc.text(noteLinestoShow, xPos + padding, lineY);
        lineY += (noteLinestoShow.length * 3.5);
        
        // Last line: Date (at bottom of box)
        doc.setFontSize(5);
        doc.setFont('helvetica', 'italic');
        const date = new Date(note.updated_at).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        });
        doc.text(date, xPos + padding, yPos + boxHeight - 2);
      }
    }
  }
  
  // Download
  const fileName = `Riepilogo_Note_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
