import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { setSEO } from "@/lib/seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setSEO("Login – Gestione Rateazioni", "Accedi per gestire le rateazioni e gli allegati.");
  }, []);

  // Redirect if already logged in
  if (user) {
    const from = location.state?.from?.pathname || "/rateazioni";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Credenziali non valide",
            description: "Email o password non corretti.",
            variant: "destructive",
          });
        } else if (error.message.includes("User already registered")) {
          toast({
            title: "Utente già registrato",
            description: "Questo indirizzo email è già registrato. Prova ad accedere.",
            variant: "destructive",
          });
          setIsSignUp(false);
        } else if (error.message.includes("Signup requires a valid password")) {
          toast({
            title: "Password non valida",
            description: "La password deve essere di almeno 6 caratteri.",
            variant: "destructive",
          });
        } else {
          toast({
            title: isSignUp ? "Errore registrazione" : "Errore accesso",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (isSignUp) {
        toast({
          title: "Registrazione completata",
          description: "Controlla la tua email per confermare l'account.",
        });
      }
    } catch (err) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore inaspettato.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md card-elevated">
        <CardHeader>
          <CardTitle>{isSignUp ? "Registrati" : "Accedi"}</CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Crea un nuovo account per gestire le rateazioni" 
              : "Accedi al tuo account per gestire le rateazioni"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password"
                placeholder={isSignUp ? "Minimo 6 caratteri" : ""}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Caricamento..." : (isSignUp ? "Registrati" : "Entra")}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm"
            >
              {isSignUp 
                ? "Hai già un account? Accedi" 
                : "Non hai un account? Registrati"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
