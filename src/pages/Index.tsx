import { useEffect, useState } from "react";
// Se qui ti dà errore sull'alias, vedi le note sotto
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: number;
  number?: string;
  created_at?: string | null;
};

export default function Index() {
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");

      const { data, error } = await supabase
        .from("rateations") // <-- nome tabella come in Supabase
        .select("id, number, created_at")
        .limit(3);

      if (error) {
        setStatus("err");
        setMessage(error.message);
      } else {
        setStatus("ok");
        setRows(data ?? []);
      }
    };

    run();
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
          <>
            <p className="mb-2">Connessione OK ✅</p>
            <p className="text-sm">
              Ho letto {rows.length} righe dalla tabella <code>rateations</code>.
            </p>
            <pre className="text-xs bg-muted p-3 rounded mt-2">
              {JSON.stringify(rows, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
