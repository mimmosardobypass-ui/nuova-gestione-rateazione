import { getPdfDocument } from '@/lib/pdfjs';

export type Rata = { 
  scadenza: string; 
  totaleEuro: number; 
  year: number; 
  seq?: number;
};

function eurosToNumber(txt: string): number {
  // accetta "2.461,33", "246, 12", "246,12 €"
  const m = txt.replace(/[€\s]/g, "")
               .match(/(\d{1,3}(?:\.\d{3})*),?(\d{2})$/);
  if (!m) return NaN;
  const intPart = m[1].replace(/\./g, "");
  const dec = m[2];
  return parseFloat(`${intPart}.${dec}`);
}

function normalizeDate(d: string, m: string, y: string): string {
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  return `${dd}-${mm}-${y}`;
}

function groupByY(items: any[], tol = 2): Array<{ y: number; line: any[] }> {
  const buckets: Array<{ y: number; line: any[] }> = [];
  for (const it of items) {
    const y = Math.round(it.transform[5]);
    let bucket = buckets.find(b => Math.abs(b.y - y) <= tol);
    if (!bucket) {
      bucket = { y, line: [] };
      buckets.push(bucket);
    }
    bucket.line.push(it);
  }
  // dall'alto al basso
  buckets.sort((a, b) => b.y - a.y);
  // ordina gli items per X crescente
  for (const b of buckets) b.line.sort((a, b) => a.transform[4] - b.transform[4]);
  return buckets;
}

function extractAmountFromTokens(tokens: any[]): string | null {
  // 1) prova per token
  const byToken = tokens.map(t => t.str).filter(s => /\d{1,3}(?:\.\d{3})*,\s*\d{2}/.test(s));
  if (byToken.length) return byToken[byToken.length - 1];

  // 2) prova su testo unito (gestisce "246," "12")
  const joined = tokens.map(t => t.str).join(" ");
  const m = joined.match(/(\d{1,3}(?:\.\d{3})*),\s*(\d{2})(?!.*\d)/);
  if (m) return `${m[1]},${m[2]}`;

  return null;
}

export async function extractAdrRateTable(file: File): Promise<Rata[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getPdfDocument({ data: arrayBuffer });

  const found: Record<string, Rata> = {};
  let sequenceNumber = 1;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = groupByY(content.items as any[]);

    for (let i = 0; i < lines.length; i++) {
      const tokens = lines[i].line;
      const text = tokens.map(t => t.str).join(" ").replace(/\s+/g, " ").trim();

      if (/TOTALE\s+COMPLESSIVAMENT[EA]\s+DOVUTO/i.test(text)) continue;

      const dm = text.match(/(\d{1,2})\s*[-\/\.]\s*(\d{1,2})\s*[-\/\.]\s*(\d{4})/);
      if (!dm) continue;

      // Importo sulla stessa riga…
      let amountTxt = extractAmountFromTokens(tokens);

      // …oppure sulla riga successiva (righe adiacenti, stesso blocco tabella)
      if (!amountTxt && i + 1 < lines.length) {
        amountTxt = extractAmountFromTokens(lines[i + 1].line);
      }

      if (!amountTxt) continue; // se proprio non c'è, salta

      const totale = eurosToNumber(amountTxt);
      if (!isFinite(totale)) continue;

      const scadenza = normalizeDate(dm[1], dm[2], dm[3]);
      found[scadenza] = { 
        scadenza, 
        totaleEuro: totale, 
        year: parseInt(dm[3], 10),
        seq: sequenceNumber++
      };
    }
  }

  const out = Object.values(found).sort((a, b) =>
    a.scadenza.localeCompare(b.scadenza)
  );

  try { await pdf.cleanup(); } catch {}
  try { await pdf.destroy(); } catch {}

  return out;
}