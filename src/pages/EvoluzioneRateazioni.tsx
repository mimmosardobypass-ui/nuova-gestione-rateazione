import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { MonthlyEvolutionChart } from "@/features/rateations/components/stats-v3/MonthlyEvolutionChart";

export default function EvoluzioneRateazioni() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentYear = new Date().getFullYear();
  const defaultYearFrom = parseInt(searchParams.get("from") || "2021");
  const defaultYearTo = parseInt(searchParams.get("to") || currentYear.toString());

  const [yearFrom, setYearFrom] = useState(defaultYearFrom);
  const [yearTo, setYearTo] = useState(defaultYearTo);

  const years = Array.from({ length: 15 }, (_, i) => 2020 + i);

  const handleYearChange = (type: "from" | "to", value: string) => {
    const newYear = parseInt(value);
    if (type === "from") {
      setYearFrom(newYear);
      setSearchParams({ from: value, to: yearTo.toString() });
    } else {
      setYearTo(newYear);
      setSearchParams({ from: yearFrom.toString(), to: value });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/statistiche-v3")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alle Statistiche
        </Button>

        <div className="text-sm text-muted-foreground">
          <span className="cursor-pointer hover:text-foreground" onClick={() => navigate("/")}>
            Home
          </span>
          <span className="mx-2">/</span>
          <span
            className="cursor-pointer hover:text-foreground"
            onClick={() => navigate("/statistiche-v3")}
          >
            Statistiche V3
          </span>
          <span className="mx-2">/</span>
          <span className="font-medium text-foreground">Evoluzione Mensile</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">📈 Evoluzione Mensile Rateazioni</h1>
        <p className="text-muted-foreground mt-1">
          Analisi dettagliata dell'andamento temporale mese per mese
        </p>
      </div>

      {/* Year Range Selector */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="space-y-2">
            <Label htmlFor="year-from">Da Anno</Label>
            <Select value={yearFrom.toString()} onValueChange={(v) => handleYearChange("from", v)}>
              <SelectTrigger id="year-from" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year-to">A Anno</Label>
            <Select value={yearTo.toString()} onValueChange={(v) => handleYearChange("to", v)}>
              <SelectTrigger id="year-to" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()} disabled={y < yearFrom}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Periodo: <span className="font-medium text-foreground">{yearFrom} - {yearTo}</span>
          </div>
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-6">
        <MonthlyEvolutionChart yearFrom={yearFrom} yearTo={yearTo} />
      </Card>
    </div>
  );
}
