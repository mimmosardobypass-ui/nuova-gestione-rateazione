import { useEffect, useState } from "react";
import { setSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { RateationsTable } from "@/components/rateations/RateationsTable";
import { NewRateationDialog } from "@/components/rateations/NewRateationDialog";

export default function Rateations() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setSEO(
      "Rateazioni – Gestione Rateazioni",
      "Elenco rateazioni con filtri, dettagli riga e gestione rate."
    );
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Rateazioni</h1>
        <NewRateationDialog onCreated={() => setRefreshKey(prev => prev + 1)} />
      </div>

      <Card className="card-elevated mt-6">
        <CardContent className="pt-6">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Tutte</TabsTrigger>
              <TabsTrigger value="attive">Attive</TabsTrigger>
              <TabsTrigger value="completate">Completate</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <Select>
                  <SelectTrigger aria-label="Filtro tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="f24">F24</SelectItem>
                    <SelectItem value="pagopa">PagoPA</SelectItem>
                    <SelectItem value="quater">Quater</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger aria-label="Filtro stato"><SelectValue placeholder="Stato" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attiva">Attiva</SelectItem>
                    <SelectItem value="completata">Completata</SelectItem>
                    <SelectItem value="ritardo">In ritardo</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Mese (MM)" aria-label="Filtro mese" />
                <Input placeholder="Anno (YYYY)" aria-label="Filtro anno" />
                <div className="flex gap-2">
                  <Button variant="secondary">Comparazione annuale</Button>
                  <Button variant="outline">Statistiche avanzate</Button>
                </div>
              </div>
              <RateationsTable key={refreshKey} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      
    </main>
  );
}
