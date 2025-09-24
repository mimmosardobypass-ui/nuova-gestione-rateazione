import { useRateationsHealth } from "@/hooks/useRateationsHealth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function RateationsHealthBanner() {
  const { suspicious, totalRows, loading } = useRateationsHealth();

  if (loading || suspicious === 0) return null;

  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <strong>Verifica dati necessaria:</strong> {suspicious} di {totalRows} rateazioni hanno 
        rate pagate ma importo pagato = €0. Controlla la sincronizzazione dei dati.
      </AlertDescription>
    </Alert>
  );
}