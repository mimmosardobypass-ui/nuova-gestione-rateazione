import { useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  useEffect(() => {
    setSEO("Login – Gestione Rateazioni", "Accedi per gestire le rateazioni e gli allegati.");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Supabase non collegato", description: "Collega Supabase per abilitare l'autenticazione email/password." });
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md card-elevated">
        <CardHeader>
          <CardTitle>Accedi</CardTitle>
          <CardDescription>Usa email e password. Richiede integrazione Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">Entra</Button>
          </form>
          <p className="text-sm text-muted-foreground mt-3">
            Suggerimento: Premi il pulsante Supabase in alto a destra per collegare il progetto e abilitare il login.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
