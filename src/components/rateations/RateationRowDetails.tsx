import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RateationRow } from "./RateationsTable";
import { toast } from "@/hooks/use-toast";
import { AttachmentsPanel } from "./AttachmentsPanel";

const installmentsMock = [
  { seq: 1, due: "2025-08-15", paidAt: "2025-08-14", amount: 400, status: "Pagata", postponed: false },
  { seq: 2, due: "2025-09-15", paidAt: "", amount: 400, status: "Da pagare", postponed: false },
  { seq: 3, due: "2025-10-15", paidAt: "", amount: 400, status: "In ritardo", postponed: true },
];

export function RateationRowDetails({ row }: { row: RateationRow }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="card-elevated lg:col-span-2">
        <CardHeader>
          <CardTitle>Rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {installmentsMock.map((it) => (
            <div key={it.seq} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary"># {it.seq}</Badge>
                <div>
                  <div className="font-medium">Scadenza: {it.due}</div>
                  <div className="text-sm text-muted-foreground">Importo: € {it.amount.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{it.status}</Badge>
                {it.postponed && <Badge variant="outline">Rimandata</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => toast({ title: "Segnata pagata" })}>Segna pagata</Button>
                <Button size="sm" variant="outline" onClick={() => toast({ title: "Posticipa", description: "Selezione data WIP" })}>Posticipa</Button>
                <Button size="sm" variant="ghost" onClick={() => toast({ title: "Elimina rata", description: "Consentita solo per manuali" })}>Elimina</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AttachmentsPanel rateationId={row.id} />
    </div>
  );
}
