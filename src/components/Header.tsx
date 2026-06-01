import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, isAdmin, signOut, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="font-serif text-xl font-bold text-foreground tracking-tight shrink-0"
        >
          Receitas da Cris
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-primary" }}
            className="text-foreground/80 hover:text-primary transition"
          >
            Catálogo
          </Link>
          {isAdmin && (
            <>
              <Link
                to="/adicionar"
                activeProps={{ className: "text-primary" }}
                className="text-foreground/80 hover:text-primary transition"
              >
                Adicionar
              </Link>
              <Link
                to="/validar"
                activeProps={{ className: "text-primary" }}
                className="text-foreground/80 hover:text-primary transition"
              >
                Validar
              </Link>
            </>
          )}
          {!loading &&
            (user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-border/60">
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  title={user.email ?? ""}
                >
                  {isAdmin && (
                    <ShieldCheck size={13} className="text-primary" aria-label="Administradora" />
                  )}
                  {user.email?.split("@")[0]}
                </span>
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                  aria-label="Sair"
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold hover:opacity-90 transition"
              >
                <LogIn size={13} aria-hidden="true" /> Entrar
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
