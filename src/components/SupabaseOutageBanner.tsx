import { isSupabaseConfigured, getSupabaseStatus } from '@/integrations/supabase/health';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';

export default function SupabaseOutageBanner() {
  const status = getSupabaseStatus();
  
  if (status === 'healthy') return null;
  
  const isDown = status === 'down';
  const Icon = isDown ? WifiOff : AlertTriangle;
  const bgClass = isDown ? 'bg-destructive' : 'bg-orange-600';
  
  return (
    <div className={`w-full ${bgClass} text-white text-sm px-4 py-2 flex items-center gap-2 z-50`}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        {isDown 
          ? 'Connessione a Supabase non disponibile. Dati live temporaneamente inattivi.' 
          : 'Problemi di connessione rilevati. Alcune funzionalità potrebbero essere limitate.'
        }
      </span>
      {!isDown && (
        <Wifi className="h-4 w-4 flex-shrink-0 animate-pulse" />
      )}
    </div>
  );
}