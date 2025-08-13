import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash } from "lucide-react";
import { RateationRowDetails } from "./RateationRowDetails";
import { EditRateationModal } from "./EditRateationModal";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOnline } from "@/hooks/use-online";

export type RateationRow = {
  id: string;
  numero: string;
  tipo: string;
  contribuente: string;
  importoTotale: number;
  importoPagato: number;
  importoRitardo: number;
  residuo: number;
  rateTotali: number;
  ratePagate: number;
  rateNonPagate: number;
  rateInRitardo: number;
};

export function RateationsTable() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rows, setRows] = useState<RateationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const [editId, setEditId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    console.log("[RateationsTable] Loading data from Supabase...");
    try {
      // Fetch base entities
      const [{ data: rateations, error: errRateations }, { data: installments, error: errInstallments }, { data: types, error: errTypes }] =
        await Promise.all([
          supabase.from("rateations").select("id, number, taxpayer_name, total_amount, status, type_id, created_at, start_due_date"),
          supabase.from("installments").select("rateation_id, amount, is_paid, due_date"),
          supabase.from("rateation_types").select("id, name"),
        ]);

      if (errRateations) throw errRateations;
      if (errInstallments) throw errInstallments;
      if (errTypes) throw errTypes;

      const typesMap = new Map<number, string>((types || []).map(t => [Number(t.id), String(t.name)]));

      const todayISO = new Date().toISOString().slice(0, 10);

      const grouped = new Map<number, { total: number; paid: number; late: number; cnt: number; cntPaid: number; cntLate: number }>();
      (installments || []).forEach((inst) => {
        const rid = Number(inst.rateation_id);
        const g = grouped.get(rid) || { total: 0, paid: 0, late: 0, cnt: 0, cntPaid: 0, cntLate: 0 };
        const amt = Number(inst.amount ?? 0);
        const isPaid = inst.is_paid === true;
        const isLate = !isPaid && inst.due_date && String(inst.due_date) < todayISO;
        g.total += amt;
        if (isPaid) g.paid += amt;
        if (isLate) g.late += amt;
        g.cnt += 1;
        if (isPaid) g.cntPaid += 1;
        if (isLate) g.cntLate += 1;
        grouped.set(rid, g);
      });

      const computed: RateationRow[] = (rateations || []).map((r) => {
        const rid = Number(r.id);
        const g = grouped.get(rid) || { total: 0, paid: 0, late: 0, cnt: 0, cntPaid: 0, cntLate: 0 };
        const importoTotale = Number(r.total_amount ?? 0);
        const importoPagato = g.paid;
        const residuo = Math.max(0, importoTotale - importoPagato);
        const rateNonPagate = Math.max(0, g.cnt - g.cntPaid);
        return {
          id: String(r.id),
          numero: String(r.number ?? ""),
          tipo: typesMap.get(Number(r.type_id)) || "-",
          contribuente: String(r.taxpayer_name ?? "-"),
          importoTotale,
          importoPagato,
          importoRitardo: g.late,
          residuo,
          rateTotali: g.cnt,
          ratePagate: g.cntPaid,
          rateNonPagate,
          rateInRitardo: g.cntLate,
        };
      });

      console.log("[RateationsTable] Computed rows:", computed);
      setRows(computed);
    } catch (e: any) {
      console.error("[RateationsTable] Load error:", e);
      setError(e?.message || "Errore di caricamento");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!online) {
      toast({ title: "Offline", description: "Sei offline: impossibile eliminare.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Confermi l'eliminazione della rateazione e delle relative rate?")) return;

    const rid = Number(id);
    console.log("[RateationsTable] Deleting rateation", rid);
    const { error: errInst } = await supabase.from("installments").delete().eq("rateation_id", rid);
    if (errInst) {
      console.error(errInst);
      toast({ title: "Errore", description: "Errore eliminando le rate.", variant: "destructive" });
      return;
    }
    const { error: errRate } = await supabase.from("rateations").delete().eq("id", rid);
    if (errRate) {
      console.error(errRate);
      toast({ title: "Errore", description: "Errore eliminando la rateazione.", variant: "destructive" });
      return;
    }
    toast({ title: "Eliminata", description: "Rateazione eliminata con successo." });
    await loadData();
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-between mb-2 px-1">
        {loading && <span className="text-sm text-muted-foreground">Caricamento…</span>}
        {!online && <span className="text-sm text-amber-600">Sei offline: i dati potrebbero non aggiornarsi.</span>}
        {error && <span className="text-sm text-red-600">Errore: {error}</span>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numero</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Contribuente</TableHead>
            <TableHead>Totale</TableHead>
            <TableHead>Pagato</TableHead>
            <TableHead>In ritardo</TableHead>
            <TableHead>Residuo</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <>
              <TableRow key={r.id} className="align-top">
                <TableCell className="font-medium">{r.numero}</TableCell>
                <TableCell><Badge variant="secondary">{r.tipo}</Badge></TableCell>
                <TableCell>{r.contribuente}</TableCell>
                <TableCell>€ {r.importoTotale.toLocaleString()}</TableCell>
                <TableCell>€ {r.importoPagato.toLocaleString()}</TableCell>
                <TableCell>€ {r.importoRitardo.toLocaleString()}</TableCell>
                <TableCell>€ {r.residuo.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="font-medium">Totali: {r.rateTotali}</div>
                    <div className="text-muted-foreground">Pagate: {r.ratePagate} · Non pagate: {r.rateNonPagate} · Ritardo: {r.rateInRitardo}</div>
                  </div>
                </TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  <Button variant="ghost" size="sm" aria-label="Dettagli" onClick={() => toggleExpand(r.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Modifica" onClick={() => setEditId(r.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Elimina" onClick={() => handleDelete(r.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              {expandedId === r.id && (
                <TableRow key={`${r.id}-details`}>
                  <TableCell colSpan={9}>
                    <RateationRowDetails row={r} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
          {rows.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={9} className="text-sm text-muted-foreground">
                Nessun dato disponibile. Crea una rateazione per iniziare.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <EditRateationModal
        open={!!editId}
        rateationId={editId}
        onOpenChange={(v) => {
          if (!v) setEditId(null)
        }}
        onSaved={() => {
          setEditId(null)
          loadData()
        }}
      />
    </div>
  );
}
