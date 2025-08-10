import { useEffect, useState } from "react";
// ATTENZIONE: usa proprio questo path con "integrazioni"
import { supabase } from "@/integrazioni/supabase/client";

export default function Index() {
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      setStatus("loading");

      // PROVA: leggo max 3 righe dalla tabella "rateations"
      // Se il nome fosse diverso nel tuo DB, cambia qui (es. "installments")
      const { data, error } = await supabase
        .from("rateations")
        .select("id, number, created_at")
        .limit(3);

      if (error) {
        setStatus("err");
        setMessage(error.message);
      } else {
        setStatus("ok");
        setRows(data ?? []);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-xl w-full">
        <h1 className="text-2xl font-bold mb-4">Test connessione a Supabase</h1>

        {status === "loading" && <p>Sto contattando Supabase…</p>}

        {status === "err" && (
          <p className="text-red-500">Errore: {message}</p>
        )}

        {status === "ok" && (
          <div>
            <p className="mb-2">Connessione OK ✅</p>
            <p className="text-sm">
              Ho letto {rows.length} righe dalla tabella <code>rateations</code>.
            </p>
            <pre className="text-xs bg-muted p-3 rounded mt-2">
              {JSON.stringify(rows, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
