import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { QuaterAtRiskItem, QUATER_VISIBILITY_WINDOW } from "@/features/rateations/hooks/useQuaterAtRisk";

interface QuaterAtRiskAlertProps {
  atRiskQuaters: QuaterAtRiskItem[];
  onNavigate: () => void;
}

const formatEuro = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Dashboard alert banner for Quater/Riam.Quater rateations at risk
 * Mostra countdown verso la data di decadenza (scadenza rata + 5gg tolleranza)
 * Visualizza a partire da 20 giorni prima della decadenza
 */
export function QuaterAtRiskAlert({ atRiskQuaters = [], onNavigate }: QuaterAtRiskAlertProps) {
  // Ensure atRiskQuaters is always an array
  const safeQuaters = Array.isArray(atRiskQuaters) ? atRiskQuaters : [];
  
  // Separa per livello di rischio con protezione null/undefined
  const critical = safeQuaters.filter(q => q?.riskLevel === 'critical');
  const warning = safeQuaters.filter(q => q?.riskLevel === 'warning');
  const caution = safeQuaters.filter(q => q?.riskLevel === 'caution');
  const ok = safeQuaters.filter(q => q?.riskLevel === 'ok');

  // Nessun alert se non ci sono Quater a rischio entro 20gg
  if (safeQuaters.length === 0) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">
          Tutte le rateazioni Quater sono in regola
        </AlertTitle>
        <AlertDescription className="text-green-800">
          Nessuna scadenza decadenza nei prossimi {QUATER_VISIBILITY_WINDOW} giorni.
        </AlertDescription>
      </Alert>
    );
  }

  // Calcola totali con protezione
  const totalCount = safeQuaters.length;
  const totalAmount = safeQuaters.reduce((sum, q) => sum + (q?.importoRata || 0), 0);
  const daysArray = safeQuaters.map(q => q?.daysToDecadence ?? Infinity).filter(d => isFinite(d));
  const minDaysToDecadence = daysArray.length > 0 ? Math.min(...daysArray) : 0;
  const nearest = safeQuaters.find(q => q?.daysToDecadence === minDaysToDecadence);

  return (
    <div className="space-y-3">
      {/* 🔴 Alert Rosso: Decadenza immediata (tolleranza esaurita) */}
      {critical.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900 font-semibold">
            🚨 {critical.length} Quater in DECADENZA
          </AlertTitle>
          <AlertDescription>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{critical.length}</div>
                <div className="text-xs text-red-700">Rateazioni</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">❌ SCADUTO</div>
                <div className="text-xs text-red-700">Tolleranza esaurita</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatEuro(critical.reduce((s, q) => s + q.importoRata, 0))}
                </div>
                <div className="text-xs text-red-700">Importo a rischio</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-red-800">
              <strong>TOLLERANZA DI 5 GIORNI ESAURITA!</strong> Le rateazioni sono decadute.
            </p>
            <Button 
              onClick={onNavigate} 
              variant="outline"
              size="sm"
              className="mt-3 border-red-600 text-red-600 hover:bg-red-100"
            >
              Vedi urgenti →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 🟠 Alert Arancione: Dentro tolleranza ma urgente (1-5 giorni) */}
      {warning.length > 0 && (
        <Alert className="border-orange-500 bg-orange-50">
          <Clock className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900 font-semibold">
            ⚠️ {warning.length} Quater con tolleranza in esaurimento
          </AlertTitle>
          <AlertDescription>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{warning.length}</div>
                <div className="text-xs text-orange-700">Rateazioni</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.min(...warning.map(q => q.daysToDecadence))} gg
                </div>
                <div className="text-xs text-orange-700">Giorni alla decadenza</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatEuro(warning.reduce((s, q) => s + q.importoRata, 0))}
                </div>
                <div className="text-xs text-orange-700">Importo a rischio</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-orange-800">
              Rate scadute, ma ancora dentro la tolleranza di 5 giorni. <strong>Pagare subito.</strong>
            </p>
            <Button 
              onClick={onNavigate} 
              variant="outline"
              size="sm"
              className="mt-3 border-orange-600 text-orange-600 hover:bg-orange-100"
            >
              Vedi dettagli →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 🟡 Alert Giallo: Attenzione (6-10 giorni) */}
      {caution.length > 0 && critical.length === 0 && warning.length === 0 && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900">
            ⏰ {caution.length} Quater con scadenza ravvicinata
          </AlertTitle>
          <AlertDescription>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{caution.length}</div>
                <div className="text-xs text-yellow-700">Rateazioni</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.min(...caution.map(q => q.daysToDecadence))} gg
                </div>
                <div className="text-xs text-yellow-700">Giorni alla decadenza</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {formatEuro(caution.reduce((s, q) => s + q.importoRata, 0))}
                </div>
                <div className="text-xs text-yellow-700">Importo</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-yellow-800">
              Scadenze imminenti. Pianificare i pagamenti entro la data indicata.
            </p>
            <Button 
              onClick={onNavigate} 
              variant="outline"
              size="sm"
              className="mt-3 border-yellow-600 text-yellow-600 hover:bg-yellow-100"
            >
              Monitora →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 🟢 Alert Verde: Solo monitoraggio (11-20 giorni) - mostrato solo se non ci sono altri */}
      {ok.length > 0 && critical.length === 0 && warning.length === 0 && caution.length === 0 && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">
            📋 {ok.length} Quater in monitoraggio
          </AlertTitle>
          <AlertDescription>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{ok.length}</div>
                <div className="text-xs text-green-700">Rateazioni</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {minDaysToDecadence} gg
                </div>
                <div className="text-xs text-green-700">Prossima decadenza</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {nearest ? formatDate(nearest.decadenceDate) : '-'}
                </div>
                <div className="text-xs text-green-700">Data</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-green-800">
              Scadenze entro {QUATER_VISIBILITY_WINDOW} giorni. Situazione sotto controllo.
            </p>
            <Button 
              onClick={onNavigate} 
              variant="outline"
              size="sm"
              className="mt-3 border-green-600 text-green-600 hover:bg-green-100"
            >
              Vedi calendario →
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
