import { Leaf } from "lucide-react";
import { CompactKpiCard } from "./CompactKpiCards";

interface QuaterSavingCardProps {
  saving: number;
  loading?: boolean;
  onClick?: () => void;
}

export function QuaterSavingCard({ saving, loading = false, onClick }: QuaterSavingCardProps) {
  return (
    <CompactKpiCard
      title="Risparmio RQ"
      value={saving}
      subtitle="Rottamazione Quater"
      icon={<Leaf className="h-4 w-4 text-emerald-600" />}
      loading={loading}
      onClick={onClick}
      highlight="primary"
      tooltip="Differenza tra debito originario e importo ridotto con Rottamazione Quater"
    />
  );
}