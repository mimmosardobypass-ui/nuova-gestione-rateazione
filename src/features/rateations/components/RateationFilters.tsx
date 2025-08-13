import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RateationFiltersProps {
  onComparazione: () => void;
  onStats: () => void;
}

export function RateationFilters({ onComparazione, onStats }: RateationFiltersProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        {/* LOVABLE:START filterControls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Tutti i tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="type1">Tipo 1</SelectItem>
                <SelectItem value="type2">Tipo 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attiva</SelectItem>
                <SelectItem value="completed">Completata</SelectItem>
                <SelectItem value="late">In ritardo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Input type="month" placeholder="Mese" />
          </div>
          <div>
            <Input type="number" placeholder="Anno" min="2020" max="2030" />
          </div>
        </div>
        {/* LOVABLE:END filterControls */}

        {/* LOVABLE:START actionButtons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onComparazione}>
            Comparazione annuale
          </Button>
          <Button variant="outline" onClick={onStats}>
            Statistiche avanzate
          </Button>
        </div>
        {/* LOVABLE:END actionButtons */}
      </CardContent>
    </Card>
  );
}