import { useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CalendarDays, Download, LineChart, Plus, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

const monthlyData = [
  { month: "Gen", dovuto: 3200, pagato: 2800 },
  { month: "Feb", dovuto: 2900, pagato: 2100 },
  { month: "Mar", dovuto: 4100, pagato: 3600 },
  { month: "Apr", dovuto: 3800, pagato: 3700 },
  { month: "Mag", dovuto: 4200, pagato: 3900 },
  { month: "Giu", dovuto: 4600, pagato: 4100 },
];

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card className="card-elevated">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </CardContent>
  </Card>
);

export default function Dashboard() {
  useEffect(() => {
    setSEO(
      "Dashboard – Gestione Rateazioni",
      "Riepilogo rateazioni: KPI e grafici mensili di importi dovuti e pagati."
    );
  }, []);

  return (
    <main className="min-h-screen">
      <section className="bg-hero">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestione Rateazioni</h1>
              <p className="text-muted-foreground mt-1">Dashboard riepilogativa e strumenti di analisi</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="btn-cta" aria-label="Confronto annuale">
                <LineChart className="mr-2 h-4 w-4" /> Confronto annuale
              </Button>
              <Button variant="secondary" className="btn-cta" aria-label="Statistiche avanzate">
                <BarChart3 className="mr-2 h-4 w-4" /> Statistiche avanzate
              </Button>
              <Button variant="secondary" className="btn-cta" aria-label="Scadenze">
                <CalendarDays className="mr-2 h-4 w-4" /> Scadenze
              </Button>
              <Button variant="outline" className="btn-cta" aria-label="Esporta">
                <Download className="mr-2 h-4 w-4" /> Esporta
              </Button>
              <a href="/rateazioni" aria-label="Nuova rateazione">
                <Button className="btn-cta">
                  <Plus className="mr-2 h-4 w-4" /> Nuova rateazione
                </Button>
              </a>
            </div>
          </div>
          <div className="mt-4">
            <Badge variant="secondary" className="rounded-full">
              <Sparkles className="h-3 w-3 mr-1" /> Design moderno pronto per Supabase
            </Badge>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Stat label="Totale dovuto" value="€ 22.300" />
          <Stat label="Totale pagato" value="€ 19.500" />
          <Stat label="Totale residuo" value="€ 2.800" />
          <Stat label="In ritardo" value="€ 1.200" />
          <Stat label="Rate pagate/da pagare" value="56 / 14" />
        </div>

        <Card className="card-elevated mt-6">
          <CardHeader>
            <CardTitle>Andamento mensile</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RTooltip />
                  <Legend />
                  <Bar dataKey="dovuto" name="Dovuto" fill="hsl(var(--primary))" />
                  <Bar dataKey="pagato" name="Pagato" fill="hsl(var(--brand))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
