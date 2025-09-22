import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Euro } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getRQRisparmioDettaglio, getRQRisparmioAggregato } from "@/features/rateations/api/risparmio";
import { fetchRateations } from "@/features/rateations/api/rateations";
import type { RQSavingDetail, RQSavingAgg } from "@/features/rateations/types/risparmio";
import { formatEuro } from "@/lib/formatters";

const RisparmiRQ = () => {
  const navigate = useNavigate();
  const [aggregateData, setAggregateData] = useState<RQSavingAgg[]>([]);
  const [detailData, setDetailData] = useState<RQSavingDetail[]>([]);
  const [riamQuaterOptions, setRiamQuaterOptions] = useState<Array<{ id: string; number: string | null; taxpayer_name: string | null }>>([]);
  const [selectedRQ, setSelectedRQ] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("aggregato");

  useEffect(() => {
    loadData();
    loadRiamQuaterOptions();
  }, [selectedRQ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const rqId = selectedRQ === "all" ? undefined : selectedRQ;
      
      const [aggregateResult, detailResult] = await Promise.all([
        getRQRisparmioAggregato(rqId),
        getRQRisparmioDettaglio(rqId)
      ]);
      
      setAggregateData(aggregateResult);
      setDetailData(detailResult);
    } catch (error) {
      console.error('Error loading risparmio data:', error);
      toast.error('Errore nel caricamento dei dati di risparmio');
    } finally {
      setLoading(false);
    }
  };

  const loadRiamQuaterOptions = async () => {
    try {
      const { rateations } = await fetchRateations();
      const riamQuaterList = rateations
        .filter(r => r.tipo === 'Riam.Quater')
        .map(r => ({
          id: r.id.toString(),
          number: r.number,
          taxpayer_name: r.taxpayer_name
        }));
      setRiamQuaterOptions(riamQuaterList);
    } catch (error) {
      console.error('Error loading Riam.Quater options:', error);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const dataToExport = activeTab === "aggregato" ? aggregateData : detailData;
    
    // TODO: Implementare export reale
    toast.info(`Export ${format.toUpperCase()} in fase di sviluppo`);
    console.log('Export data:', { format, activeTab, data: dataToExport });
  };

  const totalRisparmio = aggregateData.reduce((sum, row) => sum + row.risparmio_stimato_tot, 0);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Caricamento dati di risparmio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna alla Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Risparmio da Riammissione Quater</h1>
            <p className="text-muted-foreground">
              Confronto tra residui originari PagoPA e totali Riam.Quater
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('excel')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Euro className="h-6 w-6 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {formatEuro(totalRisparmio)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Risparmio totale stimato da tutte le Riammissioni Quater
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Riam.Quater:</label>
              <Select value={selectedRQ} onValueChange={setSelectedRQ}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Seleziona Riam.Quater" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {riamQuaterOptions.map((rq) => (
                    <SelectItem key={rq.id} value={rq.id}>
                      #{rq.number} - {rq.taxpayer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs per Aggregato/Dettaglio */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aggregato">Aggregato per RQ</TabsTrigger>
          <TabsTrigger value="dettaglio">Dettaglio collegamenti</TabsTrigger>
        </TabsList>

        {/* Tab Aggregato */}
        <TabsContent value="aggregato">
          <Card>
            <CardHeader>
              <CardTitle>Risparmio Aggregato per Riam.Quater</CardTitle>
              <CardDescription>
                Vista aggregata del risparmio per ogni Riam.Quater
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RQ #</TableHead>
                    <TableHead>Contribuente RQ</TableHead>
                    <TableHead className="text-right">Residuo Originario PagoPA</TableHead>
                    <TableHead className="text-right">Totale RQ</TableHead>
                    <TableHead className="text-right">Risparmio Stimato</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregateData.map((row) => (
                    <TableRow key={row.riam_quater_id}>
                      <TableCell className="font-medium">#{row.rq_number}</TableCell>
                      <TableCell>{row.rq_taxpayer}</TableCell>
                      <TableCell className="text-right">
                        {formatEuro(row.residuo_pagopa_tot)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(row.totale_rq)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.risparmio_stimato_tot > 0 ? "default" : "secondary"}>
                          {formatEuro(row.risparmio_stimato_tot)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRQ(row.riam_quater_id);
                            setActiveTab("dettaglio");
                          }}
                        >
                          Dettaglio
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {aggregateData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nessun dato di risparmio disponibile
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Dettaglio */}
        <TabsContent value="dettaglio">
          <Card>
            <CardHeader>
              <CardTitle>Dettaglio Collegamenti RQ ↔ PagoPA</CardTitle>
              <CardDescription>
                Vista dettagliata di ogni collegamento tra Riam.Quater e PagoPA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RQ #</TableHead>
                    <TableHead>PagoPA #</TableHead>
                    <TableHead>Contribuente PagoPA</TableHead>
                    <TableHead className="text-right">Residuo PagoPA</TableHead>
                    <TableHead className="text-right">Totale RQ</TableHead>
                    <TableHead className="text-right">Risparmio Stimato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.map((row) => (
                    <TableRow key={`${row.riam_quater_id}-${row.pagopa_id}`}>
                      <TableCell className="font-medium">#{row.rq_number}</TableCell>
                      <TableCell>#{row.pagopa_number}</TableCell>
                      <TableCell>{row.pagopa_taxpayer}</TableCell>
                      <TableCell className="text-right">
                        {formatEuro(row.residuo_pagopa)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatEuro(row.totale_rq)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.risparmio_stimato > 0 ? "default" : "secondary"}>
                          {formatEuro(row.risparmio_stimato)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detailData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nessun dettaglio di collegamento disponibile
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RisparmiRQ;