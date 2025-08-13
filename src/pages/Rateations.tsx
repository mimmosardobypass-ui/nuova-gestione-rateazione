import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { setSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { RateationsTable } from "@/components/rateations/RateationsTable";
import { NewRateationDialog } from "@/components/rateations/NewRateationDialog";

export default function Rateations() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const openOnMount = params.get("new") === "1";
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [tipo, setTipo] = useState("");
  const [stato, setStato] = useState("");
  const [mese, setMese] = useState("");
  const [anno, setAnno] = useState("");

  const handleMeseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMese(e.target.value);
  };

  const handleAnnoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnno(e.target.value);
  };

  const openComparazione = () => {
    // TODO: Implement comparazione annuale
  };

  const openStats = () => {
    // TODO: Implement statistiche avanzate
  };

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
        <NewRateationDialog 
          initialOpen={openOnMount} 
          onCreated={() => {
            setRefreshKey(prev => prev + 1);
            if (openOnMount) {
              window.history.replaceState({}, '', '/rateazioni');
            }
          }} 
        />
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
              <div className="flex flex-wrap items-end gap-3 mb-4">
                {/* Griglia filtri */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-[280px]">
                  {/* Tipo */}
                  <div className="min-w-[200px]">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="f24">F24</SelectItem>
                        <SelectItem value="pagopa">PagoPA</SelectItem>
                        <SelectItem value="quater">Quater</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stato */}
                  <div className="min-w-[200px]">
                    <Label className="text-xs">Stato</Label>
                    <Select value={stato} onValueChange={setStato}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Seleziona stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tutte">Tutte</SelectItem>
                        <SelectItem value="attive">Attive</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mese */}
                  <div className="min-w-[160px]">
                    <Label className="text-xs">Mese (MM)</Label>
                    <Input 
                      className="h-9" 
                      inputMode="numeric" 
                      placeholder="MM" 
                      value={mese} 
                      onChange={handleMeseChange} 
                    />
                  </div>

                  {/* Anno */}
                  <div className="min-w-[160px]">
                    <Label className="text-xs">Anno (YYYY)</Label>
                    <Input 
                      className="h-9" 
                      inputMode="numeric" 
                      placeholder="YYYY" 
                      value={anno} 
                      onChange={handleAnnoChange} 
                    />
                  </div>
                </div>

                {/* Azioni a destra */}
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={openComparazione}>
                    Comparazione annuale
                  </Button>
                  <Button variant="outline" size="sm" onClick={openStats}>
                    Statistiche avanzate
                  </Button>
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
