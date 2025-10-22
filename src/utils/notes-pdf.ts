import jsPDF from 'jspdf';

interface RateationNote {
  id: string;
  numero: string | null;
  tipo: string | null;
  contribuente: string | null;
  importo_totale: number | null;
  notes: string;
  notes_updated_at: string;
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
  
  if (rateation.numero) {
    doc.setFont('helvetica', 'bold');
    doc.text('Numero:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(rateation.numero, 50, yPos);
    yPos += 7;
  }
  
  if (rateation.tipo) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(rateation.tipo, 50, yPos);
    yPos += 7;
  }
  
  if (rateation.contribuente) {
    doc.setFont('helvetica', 'bold');
    doc.text('Contribuente:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(rateation.contribuente, 50, yPos);
    yPos += 7;
  }
  
  if (rateation.importo_totale) {
    doc.setFont('helvetica', 'bold');
    doc.text('Importo totale:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `€${rateation.importo_totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
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
  
  const formattedDate = new Date(rateation.notes_updated_at).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Ultima modifica: ${formattedDate}`, 20, footerY);
  
  // Download
  const fileName = `Nota_${rateation.numero || 'Rateazione'}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  doc.save(fileName);
}

export function generateNotesPDF(notes: RateationNote[]) {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const today = new Date().toLocaleDateString('it-IT');
  doc.text(`RIEPILOGO NOTE - ${today}`, 20, yPos);
  yPos += 15;
  
  // Separator line
  doc.setLineWidth(0.5);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;
  
  // Loop through notes
  notes.forEach((note, index) => {
    // Check if we need a new page
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    
    // Note number
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${note.numero || 'N/A'} - ${note.contribuente || 'N/A'}`, 20, yPos);
    yPos += 7;
    
    // Note content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitNote = doc.splitTextToSize(`Nota: ${note.notes}`, 170);
    doc.text(splitNote, 25, yPos);
    yPos += (splitNote.length * 7);
    
    // Timestamp
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const formattedDate = new Date(note.notes_updated_at).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Modificata: ${formattedDate}`, 25, yPos);
    yPos += 12;
    
    // Light separator between notes
    if (index < notes.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(20, yPos, 190, yPos);
      yPos += 8;
    }
  });
  
  // Download
  const fileName = `Riepilogo_Note_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
