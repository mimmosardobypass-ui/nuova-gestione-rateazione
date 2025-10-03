import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import type { FilteredStats, StatsKPIs, StatsFilters } from "../../types/stats";
import { exportToExcel, exportToPDF } from "../../utils/statsExport";

interface ExportButtonsProps {
  stats: FilteredStats | null;
  kpis: StatsKPIs;
  filters: StatsFilters;
  disabled: boolean;
}

export function ExportButtons({ stats, kpis, filters, disabled }: ExportButtonsProps) {
  const handleExportExcel = () => {
    if (!stats) return;
    exportToExcel(stats, kpis, filters);
  };

  const handleExportPDF = () => {
    if (!stats) return;
    exportToPDF(stats, kpis, filters);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleExportExcel}
        disabled={disabled}
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Esporta Excel
      </Button>
      <Button
        variant="outline"
        onClick={handleExportPDF}
        disabled={disabled}
      >
        <Download className="mr-2 h-4 w-4" />
        Esporta PDF
      </Button>
    </div>
  );
}
