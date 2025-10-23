import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ALERT_CONFIG, AlertLevel, AlertType, AlertDetails, getAlertLevel } from '@/constants/alertConfig';

interface ConfigurableAlertProps {
  type: AlertType;
  count: number;
  details: AlertDetails;
  onNavigate?: () => void;
}

/**
 * Componente riutilizzabile per visualizzare alert configurabili
 * con messaggi dinamici e livelli di urgenza
 */
export function ConfigurableAlert({ type, count, details, onNavigate }: ConfigurableAlertProps) {
  // Se non ci sono items a rischio, mostra success
  if (count === 0) {
    return (
      <Alert className="border-success bg-success/10">
        <CheckCircle className="h-4 w-4 text-success" />
        <AlertTitle className="text-success">
          {ALERT_CONFIG[type].messages.success.title(0)}
        </AlertTitle>
        <AlertDescription className="text-success/80">
          {ALERT_CONFIG[type].messages.success.description(details)}
        </AlertDescription>
      </Alert>
    );
  }

  // Determina livello basato su giorni minimi rimanenti
  const level: AlertLevel = getAlertLevel(details.minDaysRemaining, type);
  const config = ALERT_CONFIG[type];
  const message = config.messages[level];

  // Map level to semantic colors and icons
  const levelConfig = {
    danger: {
      icon: AlertCircle,
      className: 'border-destructive bg-destructive/10',
      titleClass: 'text-destructive',
      descClass: 'text-destructive/80',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-orange-500 bg-orange-500/10',
      titleClass: 'text-orange-700 dark:text-orange-400',
      descClass: 'text-orange-600/80 dark:text-orange-400/80',
    },
    caution: {
      icon: Info,
      className: 'border-yellow-500 bg-yellow-500/10',
      titleClass: 'text-yellow-700 dark:text-yellow-400',
      descClass: 'text-yellow-600/80 dark:text-yellow-400/80',
    },
    success: {
      icon: CheckCircle,
      className: 'border-success bg-success/10',
      titleClass: 'text-success',
      descClass: 'text-success/80',
    },
  };

  const { icon: Icon, className, titleClass, descClass } = levelConfig[level];

  return (
    <Alert className={className}>
      <Icon className={`h-4 w-4 ${titleClass}`} />
      <AlertTitle className={titleClass}>
        {message.title(count)}
      </AlertTitle>
      <AlertDescription className={descClass}>
        {message.description(details)}
      </AlertDescription>
      {onNavigate && (
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigate}
          className="mt-3 w-full sm:w-auto"
        >
          Vedi rateazioni a rischio
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </Alert>
  );
}
