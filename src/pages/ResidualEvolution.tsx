import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TrendingUp, Download, Printer, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { useResidualEvolution } from '@/features/rateations/hooks/useResidualEvolution';
import {
  exportResidualEvolutionToExcel,
  printResidualEvolution,
} from '@/features/rateations/utils/residualEvolutionExport';
import { formatEuroFromCents } from '@/lib/formatters';
import {
  MONTH_NAMES,
  TYPE_COLORS,
  type PayFilterType,
  type RateationType,
  type ResidualEvolutionFilters,
} from '@/features/rateations/types/residual-evolution';

const ALL_TYPES: RateationType[] = ['F24', 'PagoPa', 'Rottamazione Quater', 'Riam. Quater'];

export default function ResidualEvolution() {
  const currentYear = new Date().getFullYear();

  const [filters, setFilters] = useState<ResidualEvolutionFilters>({
    yearFrom: Math.max(2022, currentYear - 1),
    yearTo: Math.min(2032, currentYear + 2),
    payFilter: 'unpaid',
    selectedTypes: ALL_TYPES,
  });

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  const { data, kpis, loading, error } = useResidualEvolution(filters);

  const years = Array.from(
    { length: filters.yearTo - filters.yearFrom + 1 },
    (_, i) => filters.yearFrom + i
  );

  const toggleMonth = (yearMonth: string) => {
    setOpenMonths((prev) => ({ ...prev, [yearMonth]: !prev[yearMonth] }));
  };

  const toggleType = (type: RateationType) => {
    setFilters((prev) => ({
      ...prev,
      selectedTypes: prev.selectedTypes.includes(type)
        ? prev.selectedTypes.filter((t) => t !== type)
        : [...prev.selectedTypes, type],
    }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Evoluzione Debito Residuo</h1>
            <p className="text-sm text-muted-foreground">
              Analisi mensile con dettaglio per tipologia di rateazione
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportResidualEvolutionToExcel(data, kpis, filters)}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={printResidualEvolution}
            disabled={loading}
          >
            <Printer className="h-4 w-4 mr-2" />
            Stampa
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Year Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Anno Da</Label>
              <Select
                value={filters.yearFrom.toString()}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, yearFrom: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => 2022 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anno A</Label>
              <Select
                value={filters.yearTo.toString()}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, yearTo: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => 2022 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Filter */}
          <div className="space-y-2">
            <Label>Filtra per Stato</Label>
            <RadioGroup
              value={filters.payFilter}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, payFilter: v as PayFilterType }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unpaid" id="unpaid" />
                <Label htmlFor="unpaid">Non Pagate</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid">Pagate</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all">Tutte</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Type Filters */}
          <div className="space-y-2">
            <Label>Tipologie</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={filters.selectedTypes.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <Label htmlFor={type} className="cursor-pointer">
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Totale Periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEuroFromCents(kpis.totalPeriod)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Media Mensile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEuroFromCents(kpis.averageMonth)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Picco Mese</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEuroFromCents(kpis.peakMonth)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Mesi Attivi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activeMonths}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
                      Mese
                    </TableHead>
                    {years.map((year) => (
                      <TableHead key={year} className="text-center min-w-[120px] border-r">
                        {year}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Iterate through 12 months as primary rows */}
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const key = `month-${month}`;
                    const isOpen = openMonths[key];

                    return (
                      <Collapsible key={key} open={isOpen} onOpenChange={() => toggleMonth(key)}>
                        {/* Month Name Row (Trigger) */}
                        <TableRow className="border-b">
                          <TableCell className="sticky left-0 bg-background">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-semibold">{MONTH_NAMES[month - 1]}</span>
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          {/* Empty cells for each year */}
                          {years.map((year) => (
                            <TableCell key={year} className="text-center border-r" />
                          ))}
                        </TableRow>

                        {/* Totale Mensile Row - shows data for all years */}
                        <TableRow className="bg-muted/10">
                          <TableCell className="sticky left-0 bg-muted/10 pl-8 text-sm text-muted-foreground">
                            Totale Mensile
                          </TableCell>
                          {years.map((year) => (
                            <TableCell key={year} className="text-center font-mono border-r">
                              {formatEuroFromCents(data[year]?.[month]?.total || 0)}
                            </TableCell>
                          ))}
                        </TableRow>

                        {/* Scad. Progressive Row - shows data for all years */}
                        <TableRow className="bg-muted/10">
                          <TableCell className="sticky left-0 bg-muted/10 pl-8 text-sm text-muted-foreground">
                            Scad. Progressive
                          </TableCell>
                          {years.map((year) => (
                            <TableCell key={year} className="text-center font-mono text-primary border-r">
                              {formatEuroFromCents(data[year]?.progressive[month] || 0)}
                            </TableCell>
                          ))}
                        </TableRow>

                        {/* Expanded Content: Type Rows - shows data for all years */}
                        <CollapsibleContent asChild>
                          <>
                            {filters.selectedTypes.map((type) => (
                              <TableRow key={type} className="bg-background">
                                <TableCell className="sticky left-0 bg-background pl-12">
                                  <Badge
                                    style={{ backgroundColor: TYPE_COLORS[type] }}
                                    className="text-white"
                                  >
                                    {type}
                                  </Badge>
                                </TableCell>
                                {years.map((year) => (
                                  <TableCell key={year} className="text-center font-mono text-sm border-r">
                                    {formatEuroFromCents(data[year]?.[month]?.[type] || 0)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}

                  {/* TOTALE ANNO Row - single row with all years */}
                  <TableRow className="bg-primary/10 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-primary/10">TOTALE ANNO</TableCell>
                    {years.map((year) => (
                      <TableCell key={year} className="text-center font-mono border-r">
                        {formatEuroFromCents(data[year]?.totalYear || 0)}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* MEDIA MENSILE Row - single row with all years */}
                  <TableRow className="bg-primary/5 font-semibold border-b-4">
                    <TableCell className="sticky left-0 bg-primary/5">MEDIA MENSILE</TableCell>
                    {years.map((year) => (
                      <TableCell key={year} className="text-center font-mono text-primary border-r">
                        {formatEuroFromCents(data[year]?.averageMonth || 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
