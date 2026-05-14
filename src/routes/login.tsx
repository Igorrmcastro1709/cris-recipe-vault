import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Receitas da Cris" },
      { name: "description", content: "Faça login para gerenciar suas receitas, avaliações e favoritas." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    // Already signed in — bounce home
    navigate({ to: "/" });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name || null },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está logada.");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vinda de volta!");
        navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        toast.error(msg);
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      toast.success("Bem-vinda!");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no login com Google";
      toast.error(msg);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-md mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </p>
        <h1 className="font-serif text-4xl font-bold text-foreground mb-3">
          {mode === "signin" ? "Bem-vinda de volta" : "Vamos começar"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {mode === "signin"
            ? "Acesse sua conta para gerenciar suas receitas."
            : "A primeira pessoa a se cadastrar vira administradora."}
        </p>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 border border-border bg-card hover:bg-muted px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60"
        >
          <GoogleLogo /> Continuar com Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <span className="h-px bg-border flex-1" /> ou <span className="h-px bg-border flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="name">
                Como podemos te chamar?
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Seu nome"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="voce@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "••••••••"}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === "signin" ? (
              <LogIn size={16} />
            ) : (
              <UserPlus size={16} />
            )}
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          {mode === "signin" ? (
            <>
              Ainda não tem conta?{" "}
              <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem uma conta?{" "}
              <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">
                Entrar
              </button>
            </>
          )}
        </p>

        <p className="text-xs text-muted-foreground/80 mt-8 text-center">
          <Link to="/" className="hover:text-primary">← Voltar ao catálogo</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.1z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.5 39.5 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.5l6.2 5.3C40.9 36.6 44 31 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
