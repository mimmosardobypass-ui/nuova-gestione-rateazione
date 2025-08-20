import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/formatters";
import { ArrowDown, ArrowRight, DollarSign } from "lucide-react";
import { DecadenceDashboard } from "../types";

interface SaldoDecadutoCardProps {
  data: DecadenceDashboard;
  onClick?: () => void;
}

export function SaldoDecadutoCard({ data, onClick }: SaldoDecadutoCardProps) {
  const { gross_decayed, transferred, net_to_transfer } = data;

  return (
    <Card 
      className={`transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Saldo Decaduto
        </CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Main amount - Net to transfer */}
          <div>
            <div className="text-2xl font-bold">
              {formatEuro(net_to_transfer)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Netto da trasferire
            </p>
          </div>

          {/* Pills for gross and transferred */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive" className="text-xs">
              <ArrowDown className="h-3 w-3 mr-1" />
              Decaduto: {formatEuro(gross_decayed)}
            </Badge>
            
            {transferred > 0 && (
              <Badge variant="secondary" className="text-xs">
                <ArrowRight className="h-3 w-3 mr-1" />
                Trasferito: {formatEuro(transferred)}
              </Badge>
            )}
          </div>

          {/* Progress indicator if there are transfers */}
          {gross_decayed > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Trasferimento</span>
                <span>{Math.round((transferred / gross_decayed) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((transferred / gross_decayed) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}