import { getPdfDocument } from '@/lib/pdfjs';

export type Rata = { scadenza: string; totaleEuro: number; year: number; seq?: number };

type Token = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function toTokens(items: any[]): Token[] {
  // PDF.js: transform = [a,b,c,d,e(x),f(y)]
  return (items || []).map((it: any) => ({
    str: String(it.str ?? ""),
    x: Number(it.transform?.[4] ?? 0),
    y: Number(it.transform?.[5] ?? 0),
    w: Number(it.width ?? 0),
    h: Number(it.height ?? 0),
  }));
}

function eurosToNumber(txt: string): number {
  // accetta "2.461,33", "246, 12", "246,12€"
  const clean = txt.replace(/[€\s]/g, "");
  const m = clean.match(/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/);
  if (!m) return NaN;
  const intPart = m[1].replace(/\./g, "");
  const dec = m[2];
  return parseFloat(`${intPart}.${dec}`);
}

function normalizeDate(d: string, m: string, y: string) {
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  return `${dd}-${mm}-${y}`;
}

function joinTokens(tokens: Token[], withSpaces = false) {
  return tokens.map(t => t.str).join(withSpaces ? " " : "");
}

function looksLikeAmount(s: string) {
  // senza spazi, con virgola
  const clean = s.replace(/\s|€/g, "");
  return /\d{1,3}(?:\.\d{3})*,\d{2}$/.test(clean);
}

function stitchAmountRightOf(tokens: Token[], anchor: Token, tolY: number): string | null {
  // candidati: token a destra dell'ancora e con |ΔY| ≤ tolY
  const band = tokens
    .filter(t => t.x > anchor.x && Math.abs(t.y - anchor.y) <= tolY)
    .sort((a, b) => a.x - b.x);

  if (!band.length) return null;

  // prova finestre da 1 a 5 token (gestisce "246," + "12" [+ "€"])
  for (let win = 5; win >= 1; win--) {
    for (let i = 0; i <= band.length - win; i++) {
      const slice = band.slice(i, i + win);
      const joined = joinTokens(slice).replace(/\s/g, "");
      if (looksLikeAmount(joined)) {
        const m = joined.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
        if (m) return `${m[1]},${m[2]}`;
      }
    }
  }
  return null;
}

function groupByY(items: Token[], tol = 2): Array<{ y: number; line: Token[] }> {
  const lines: Array<{ y: number; line: Token[] }> = [];
  for (const it of items) {
    let b = lines.find(L => Math.abs(L.y - it.y) <= tol);
    if (!b) {
      b = { y: it.y, line: [] };
      lines.push(b);
    }
    b.line.push(it);
  }
  // dall'alto al basso
  lines.sort((a, b) => b.y - a.y);
  for (const L of lines) L.line.sort((a, b) => a.x - b.x);
  return lines;
}

function isTotalsLineText(s: string) {
  return /TOTALE\s+COMPLESSIVAMENT[EA]\s+DOVUTO/i.test(s);
}

/** Trova date anche se spezzate su più token sulla stessa riga. */
function findDatesMultiToken(lines: Array<{ y: number; line: Token[] }>): Array<{
  anchor: Token; dd: string; mm: string; yyyy: string;
}> {
  const dates: Array<{ anchor: Token; dd: string; mm: string; yyyy: string }> = [];

  for (const L of lines) {
    const tokens = L.line;
    const lineText = tokens.map(t => t.str).join(" ").replace(/\s+/g, " ").trim();
    if (isTotalsLineText(lineText)) continue;

    // sliding window: unisci 1..6 token contigui e prova a matchare la data
    for (let i = 0; i < tokens.length; i++) {
      for (let win = 1; win <= 6 && i + win <= tokens.length; win++) {
        const slice = tokens.slice(i, i + win);
        const joinedNoSpace = joinTokens(slice, false); // mantiene separatori "/-."
        const m = joinedNoSpace.match(/(\d{1,2})\s*[-\/\.]\s*(\d{1,2})\s*[-\/\.]\s*(\d{4})/);
        if (m) {
          // ancora = ultimo token della finestra (fine data)
          const anchor = slice[slice.length - 1];
          dates.push({ anchor, dd: m[1], mm: m[2], yyyy: m[3] });
          // salta oltre questa finestra per evitare duplicati sulla stessa riga
          i = i + win - 1;
          break;
        }
      }
    }
  }

  return dates;
}

export async function extractAdrRateTable(file: File): Promise<Rata[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getPdfDocument({ data: arrayBuffer });

  const found: Record<string, Rata> = {};

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const tokens = toTokens(content.items as any[]);
    const lines = groupByY(tokens, 2);

    const dates = findDatesMultiToken(lines);

    for (const d of dates) {
      // PASSO 1: fascia stretta
      let amountTxt = stitchAmountRightOf(tokens, d.anchor, 6);
      // PASSO 2: fallback fascia larga
      if (!amountTxt) amountTxt = stitchAmountRightOf(tokens, d.anchor, 12);
      if (!amountTxt) continue;

      const value = eurosToNumber(amountTxt);
      if (!isFinite(value)) continue;

      const scadenza = normalizeDate(d.dd, d.mm, d.yyyy);
      found[scadenza] = { scadenza, totaleEuro: value, year: parseInt(d.yyyy, 10) };
    }
  }

  // Ordina cronologicamente (usa chiave ISO)
  const out = Object.values(found)
    .sort((a, b) => {
      const ka = a.scadenza.split("-").reverse().join(""); // yyyy mm dd
      const kb = b.scadenza.split("-").reverse().join("");
      return ka.localeCompare(kb);
    });

  // Sanity check: se le righe sono < 10, mostra diagnostica
  if (out.length < 10) {
    console.log("⚠️ Possibile riga mancante - Righe trovate:", out.length);
    console.table(out.map(r => ({ scadenza: r.scadenza, totale: r.totaleEuro })));
  }

  try { await pdf.cleanup(); } catch {}
  try { await pdf.destroy(); } catch {}

  return out;
}