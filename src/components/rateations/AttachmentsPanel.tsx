import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

export function AttachmentsPanel({ rateationId }: { rateationId: string }) {
  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle>Allegati</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">Nessun allegato</p>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => toast({ title: "Storage disabilitato", description: "Collega Supabase per caricare allegati." })}>Upload</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Richiede Supabase Storage</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={() => toast({ title: "Apri", description: "Signed URL non disponibile senza Supabase" })}>
            Apri esempio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
