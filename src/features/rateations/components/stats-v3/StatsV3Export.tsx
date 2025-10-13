import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import type { StatsV3Data, StatsV3Filters } from "../../hooks/useStatsV3";
import { exportToExcelV3, exportToPDFV3, printReport } from "../../utils/statsV3Export";

interface StatsV3ExportProps {
  data: StatsV3Data;
  filters: StatsV3Filters;
}

export function StatsV3Export({ data, filters }: StatsV3ExportProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-6 justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToPDFV3(data, filters)}
        className="gap-2"
      >
        <FileDown className="h-4 w-4" />
        Esporta PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToExcelV3(data, filters)}
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Esporta Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={printReport}
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        Stampa Report
      </Button>
    </div>
  );
}
