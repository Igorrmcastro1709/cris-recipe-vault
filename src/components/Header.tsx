import { Link } from "@tanstack/react-router";

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-serif text-xl font-bold text-foreground tracking-tight">
          Receitas da Cris
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }} className="text-foreground/80 hover:text-primary transition">
            Catálogo
          </Link>
          <Link to="/validar" activeProps={{ className: "text-primary" }} className="text-foreground/80 hover:text-primary transition">
            Validar
          </Link>
        </nav>
      </div>
    </header>
  );
}
