import { useEffect, useMemo, useState } from "react";
// Usa lo stesso path che già funziona nel tuo progetto.
// Se l'alias "@" non funziona, usa un percorso relativo corretto.
import { supabase } from "@/integrations/supabase/client";

// 👉 Cambia qui se la tua tabella ha un altro nome (es. "rateations")
const TABLE = "installments";

type Row = {
  amount: number | null;
  is_paid: boolean | null;
  due_date: string | null;     // "YYYY-MM-DD" oppure null
  created_at: string;          // datetime ISO
};

export default function Index() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from(TABLE)
        .select("amount, is_paid, due_date, created_at")
        .order("due_date", { ascending: true })
        .limit(1000);

      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  // formatter € (mostra sempre 0,00 se n è 0)
  const euro = (n: number) =>
    n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  // KPI (con fallback a 0 se non ci sono dati)
  const totalDue = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const totalPaid = useMemo(
    () =>
      rows
        .filter((r) => !!r.is_paid)
        .reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const totalResiduo = Math.max(totalDue - totalPaid, 0);

  const todayISO = new Date().toISOString().slice(0, 10);
  const totalOverdue = useMemo(
    () =>
      rows
        .filter((r) => !r.is_paid && r.due_date && r.due_date < todayISO)
        .reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows, todayISO]
  );

  const paidCount = rows.filter((r) => !!r.is_paid).length;
  const totalCount = rows.length;

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard – Gestione Rateazioni</h1>

      {loading && <p>Sto caricando…</p>}
      {error && <p className="text-red-600">Errore: {error}</p>}

      {!loading && !error && (
        <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Kpi label="Totale dovuto" value={euro(totalDue)} />
          <Kpi label="Totale pagato" value={euro(totalPaid)} />
          <Kpi label="Totale residuo" value={euro(totalResiduo)} />
          <Kpi label="In ritardo" value={euro(totalOverdue)} />
          <Kpi label="Rate pagate/da pagare" value={`${paidCount} / ${totalCount}`} />
        </section>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm bg-white/5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
