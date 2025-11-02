import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CalendarDays,
  Download,
  LineChart,
  Plus,
  Sparkles,
} from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import ResidualDecadenceSection from "@/pages/dashboard/ResidualDecadenceSection";
import { toLocalISO } from "@/utils/date";
import { useF24AtRisk } from "@/features/rateations/hooks/useF24AtRisk";
import { usePagopaAtRisk } from "@/features/rateations/hooks/usePagopaAtRisk";
import { ConfigurableAlert } from "@/features/rateations/components/ConfigurableAlert";
import { AtRiskReportSelector } from "@/features/rateations/components/AtRiskReportSelector";
import { calculateAlertDetails } from "@/constants/alertConfig";
import { FreeNotesCard } from "@/components/FreeNotesCard";
import { RecentNotesCard } from "@/features/rateations/components/RecentNotesCard";

type Installment = {
  id: number;
  amount: number | null;
  is_paid: boolean | null;
  due_date: string | null;   // ISO date (YYYY-MM-DD) o null
  created_at: string;        // ISO datetime
  owner_uid: string;         // Required for RLS
};

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
  console.log('🟣 [Dashboard] Component rendering');
  const navigate = useNavigate();
  
  // SEO
  useEffect(() => {
    setSEO(
      "Dashboard – Gestione Rateazioni",
      "Riepilogo rateazioni: KPI e grafici mensili di importi dovuti e pagati."
    );
  }, []);

  // Stato dati reali
  const [rows, setRows] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch da Supabase
  const fetchInstallments = async () => {
    setLoading(true);
    
    // Get current user for RLS compliance
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[Dashboard] User not authenticated, skipping data load");
      setLoading(false);
      return;
    }

    console.log("[Dashboard] Loading installments for user:", user.id);
    
    const { data, error } = await supabase
      .from("installments")
      .select("id, amount, is_paid, due_date, created_at, owner_uid")
      .eq("owner_uid", user.id)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("[Dashboard] Error loading installments:", error);
      setError(error.message);
    } else {
      console.log("[Dashboard] Installments loaded:", data?.length ?? 0);
      setRows((data || []) as Installment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInstallments();
  }, []);

  // Listen for KPI reload events from migration operations
  useEffect(() => {
    const handleKpiReload = () => {
      console.log("[Dashboard] KPI reload event received, refreshing data");
      fetchInstallments();
    };

    window.addEventListener('rateations:reload-kpis', handleKpiReload);
    return () => window.removeEventListener('rateations:reload-kpis', handleKpiReload);
  }, []);

  // Alert hooks
  const { atRiskF24s, loading: loadingF24Risk } = useF24AtRisk();
  const { atRiskPagopas, loading: loadingPagopaRisk } = usePagopaAtRisk();

  // Calculate alert details for dynamic messages
  const f24Details = useMemo(() => 
    calculateAlertDetails(atRiskF24s, 'f24'), 
    [atRiskF24s]
  );
  const pagopaDetails = useMemo(() => 
    calculateAlertDetails(atRiskPagopas, 'pagopa'), 
    [atRiskPagopas]
  );

  // Debug: Log stato alert PagoPA
  console.log('🟢 [Dashboard] PagoPA Alert State:', {
    loading: loadingPagopaRisk,
    count: atRiskPagopas.length,
    details: pagopaDetails,
    items: atRiskPagopas
  });

  // Calcoli
  const totalDue = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const totalPaid = useMemo(
    () =>
      rows
        .filter((r) => r.is_paid === true)
        .reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const totalResiduo = Math.max(totalDue - totalPaid, 0);

  const todayISO = toLocalISO(new Date());
  const totalOverdue = useMemo(
    () =>
      rows
        .filter((r) => r.is_paid !== true && r.due_date && r.due_date < todayISO)
        .reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  const paidCount = rows.filter((r) => r.is_paid === true).length;
  const totalCount = rows.length;

  // Dati per grafico mensile (Gen..Dic)
  const monthlyData = useMemo(() => {
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const base = months.map((m) => ({ month: m, dovuto: 0, pagato: 0 }));

    rows.forEach((r) => {
      // se manca la due_date uso created_at così il record finisce comunque in un mese
      const d = new Date(r.due_date || r.created_at);
      const idx = d.getMonth(); // 0..11
      base[idx].dovuto += Number(r.amount || 0);
      if (r.is_paid === true) base[idx].pagato += Number(r.amount || 0);
    });

    return base;
  }, [rows]);

  const euro = (n: number) =>
    n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="bg-hero">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Gestione Rateazioni
              </h1>
              <p className="text-muted-foreground mt-1">
                Dashboard riepilogativa e strumenti di analisi
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="default" 
                className="btn-cta" 
                onClick={() => navigate("/rateazioni")}
                aria-label="Vedi tutte le rateazioni"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Vedi Rateazioni
              </Button>
              <Button variant="secondary" className="btn-cta" aria-label="Confronto annuale">
                <LineChart className="mr-2 h-4 w-4" /> Confronto annuale
              </Button>
              <Button variant="secondary" className="btn-cta" aria-label="Scadenze">
                <CalendarDays className="mr-2 h-4 w-4" /> Scadenze
              </Button>
              <Button variant="outline" className="btn-cta" aria-label="Esporta">
                <Download className="mr-2 h-4 w-4" /> Esporta
              </Button>
              <Button 
                className="btn-cta" 
                onClick={() => navigate("/rateazioni?new=1")}
                aria-label="Nuova rateazione"
              >
                <Plus className="mr-2 h-4 w-4" /> Nuova rateazione
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <Badge variant="secondary" className="rounded-full">
              <Sparkles className="h-3 w-3 mr-1" /> Design moderno pronto per Supabase
            </Badge>
          </div>
        </div>
      </section>

      {/* KPI */}
      <section className="container mx-auto px-4 py-8 md:py-10">
        {loading && (
          <p className="text-sm text-muted-foreground mb-4">Sto caricando…</p>
        )}
        {error && (
          <p className="text-sm text-red-500 mb-4">Errore: {error}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Stat label="Totale dovuto" value={euro(totalDue)} />
          <Stat label="Totale pagato" value={euro(totalPaid)} />
          <Stat label="Totale residuo" value={euro(totalResiduo)} />
          <Stat label="In ritardo" value={euro(totalOverdue)} />
          <Stat label="Rate pagate/da pagare" value={`${paidCount} / ${totalCount}`} />
        </div>

        {/* Compact KPI Cards */}
        <ResidualDecadenceSection />

        {/* Note e Promemoria Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <RecentNotesCard />
          <FreeNotesCard />
        </div>

        {/* Comparazione Annuale Card */}
        <Card 
          className="card-elevated cursor-pointer hover:shadow-lg transition-shadow mt-6"
          onClick={() => navigate("/rateazioni?view=annual-comparison")}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm text-muted-foreground">
                Comparazione Annuale
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold tracking-tight">
              Confronto Anno su Anno (KPI)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Visualizza 4 card KPI con confronto 2024 vs 2025: Totale Rateazioni, Importo Totale, Pagato, Residuo
            </p>
            <Button variant="ghost" className="mt-2 w-full" size="sm">
              Visualizza →
            </Button>
          </CardContent>
        </Card>

        {/* Configurable Alerts - Solo informativi */}
        <div className="mt-6 space-y-4">
          {!loadingF24Risk && (
            <ConfigurableAlert
              type="f24"
              count={atRiskF24s.length}
              details={f24Details}
            />
          )}
          
          {(() => {
            try {
              if (loadingPagopaRisk) {
                return (
                  <div className="border border-muted bg-muted/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Caricamento alert PagoPA...
                      </p>
                    </div>
                  </div>
                );
              }
              
              console.log('🟡 [Dashboard] Rendering PagoPA ConfigurableAlert with count:', atRiskPagopas.length);
              return (
                <ConfigurableAlert
                  type="pagopa"
                  count={atRiskPagopas.length}
                  details={pagopaDetails}
                />
              );
            } catch (error) {
              console.error('🔴 [Dashboard] Error rendering PagoPA alert:', error);
              return (
                <div className="border border-destructive bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm text-destructive font-semibold">
                    Errore visualizzazione alert PagoPA
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(error)}
                  </p>
                </div>
              );
            }
          })()}
        </div>

        {/* Global At-Risk Report Selector */}
        <div className="mt-6">
          <AtRiskReportSelector 
            f24Count={atRiskF24s.length} 
            pagopaCount={atRiskPagopas.length} 
          />
        </div>

        {/* Link per vedere dettagli completi */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            Questa dashboard mostra un riepilogo generale. Per vedere l'elenco completo delle rateazioni:
          </p>
          <Button 
            variant="outline" 
            onClick={() => navigate("/rateazioni")}
            className="w-full sm:w-auto"
          >
            Vai all'elenco completo rateazioni →
          </Button>
        </div>

        {/* Grafico */}
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
