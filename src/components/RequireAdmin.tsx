import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert, LogIn, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/auth";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, adminError, refreshAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <ShieldAlert className="mx-auto text-primary mb-4" size={32} aria-hidden="true" />
          <h1 className="font-serif text-2xl font-bold mb-2">Faça login para continuar</h1>
          <p className="text-muted-foreground mb-6">Esta área é só para a Cris.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
          >
            <LogIn size={15} aria-hidden="true" /> Entrar
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <ShieldAlert className="mx-auto text-primary mb-4" size={32} aria-hidden="true" />
          <h1 className="font-serif text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground mb-6">
            Esta área é só para administradoras. Você pode navegar pelo catálogo livremente.
          </p>
          {adminError && (
            <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Erro ao verificar permissão: {adminError}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void refreshAdmin()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
            >
              <RefreshCw size={15} aria-hidden="true" /> Verificar permissão
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              Voltar ao catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
