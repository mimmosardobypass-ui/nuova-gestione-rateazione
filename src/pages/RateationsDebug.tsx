import React from "react";
import { useRateations } from "../features/rateations/hooks/useRateations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RateationsDebug() {
  const { 
    rows, 
    loading, 
    error, 
    info, 
    refresh, 
    addRateation, 
    updateRateation, 
    deleteRateation 
  } = useRateations();

  const onAdd = async () => {
    try {
      const now = new Date();
      await addRateation({
        number: "TEST-" + now.toISOString().slice(11, 19),
        type_id: 1, // Assuming type 1 exists
        taxpayer_name: "Test Contribuente",
        start_due_date: now.toISOString().slice(0, 10),
        frequency: "monthly",
        total_amount: 100,
        status: "attiva",
        notes: "Creato da debug",
      });
    } catch (err) {
      console.error("Add error:", err);
      alert("Errore nell'aggiunta: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const onUpdateFirst = async () => {
    if (!rows[0]) return;
    try {
      await updateRateation(rows[0].id, { 
        notes: "Modificata da debug - " + new Date().toLocaleTimeString() 
      });
    } catch (err) {
      console.error("Update error:", err);
      alert("Errore nella modifica: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const onDeleteFirst = async () => {
    if (!rows[0]) return;
    try {
      await deleteRateation(rows[0].id);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Errore nell'eliminazione: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Rateations Debug Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-muted-foreground">Caricamento…</p>}
          {error && <p className="text-destructive font-medium">Errore: {error}</p>}
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Count:</strong> {info.count}
            </div>
            <div>
              <strong>Last updated:</strong> {info.lastUpdatedAt ? new Date(info.lastUpdatedAt).toLocaleString() : "-"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={refresh} variant="outline">
              🔄 Refresh
            </Button>
            <Button onClick={onAdd} variant="default">
              ➕ Inserisci Demo
            </Button>
            <Button 
              onClick={onUpdateFirst} 
              disabled={!rows[0]} 
              variant="secondary"
            >
              ✏️ Modifica Prima
            </Button>
            <Button 
              onClick={onDeleteFirst} 
              disabled={!rows[0]} 
              variant="destructive"
            >
              🗑️ Elimina Prima
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rateazioni ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nessuna rateazione trovata
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div 
                  key={r.id} 
                  className="p-3 border rounded-lg bg-muted/30"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <strong>Numero:</strong> {r.numero}
                    </div>
                    <div>
                      <strong>Tipo:</strong> {r.tipo}
                    </div>
                    <div>
                      <strong>Contribuente:</strong> {r.contribuente || "N/A"}
                    </div>
                    <div>
                      <strong>Importo:</strong> €{r.importoTotale.toFixed(2)}
                    </div>
                    <div>
                      <strong>Rate Totali:</strong> {r.rateTotali}
                    </div>
                    <div>
                      <strong>Rate Pagate:</strong> {r.ratePagate}
                    </div>
                    <div>
                      <strong>In Ritardo:</strong> {r.rateInRitardo}
                    </div>
                    <div>
                      <strong>Residuo:</strong> €{r.residuo.toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    ID: {r.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}