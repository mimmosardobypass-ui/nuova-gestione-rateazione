import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { toast } from "@/hooks/use-toast";

export default function Test() {
  useEffect(() => {
    setSEO("Test – Gestione Rateazioni", "Pagina di test/health.");
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Test / Health</h1>
        <Button onClick={() => toast({ title: "Ping", description: "OK" })}>Ping</Button>
      </div>
    </main>
  );
}
