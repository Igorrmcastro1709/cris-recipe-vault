import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Instagram, FileText, Video, Image as ImageIcon, Link as LinkIcon, Plus, Trash2, Check } from "lucide-react";
import { Header } from "@/components/Header";
import type { SourceType } from "@/lib/recipes";

export const Route = createFileRoute("/adicionar")({
  head: () => ({
    meta: [
      { title: "Adicionar receita — Receitas da Cris" },
      { name: "description", content: "Cole o link ou envie o arquivo da receita: Instagram, PDF, vídeo, imagem ou link." },
    ],
  }),
  component: Adicionar,
});

const STORAGE_KEY = "receitas-da-cris:drafts";

interface Draft {
  id: string;
  title: string;
  category: string;
  source: SourceType;
  sourceUrl: string;
  notes: string;
  createdAt: number;
}

const sourceOptions: { value: SourceType; label: string; icon: typeof Instagram; placeholder: string; hint: string }[] = [
  { value: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://www.instagram.com/p/...", hint: "Cole o link do post ou Reel" },
  { value: "video", label: "Vídeo", icon: Video, placeholder: "https://youtube.com/watch?v=...", hint: "YouTube, TikTok ou outro" },
  { value: "link", label: "Link / Site", icon: LinkIcon, placeholder: "https://blogdereceitas.com/...", hint: "Blog, site ou artigo" },
  { value: "pdf", label: "PDF", icon: FileText, placeholder: "URL do PDF ou nome do arquivo", hint: "Link público ou referência" },
  { value: "image", label: "Imagem", icon: ImageIcon, placeholder: "URL da imagem", hint: "Foto da receita escrita" },
];

function Adicionar() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [source, setSource] = useState<SourceType>("instagram");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: Draft[]) => {
    setDrafts(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const current = sourceOptions.find(o => o.value === source)!;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) return;
    const draft: Draft = {
      id: crypto.randomUUID(),
      title: title.trim() || "Sem título",
      category: category.trim() || "Sem categoria",
      source,
      sourceUrl: sourceUrl.trim(),
      notes: notes.trim(),
      createdAt: Date.now(),
    };
    persist([draft, ...drafts]);
    setSourceUrl(""); setTitle(""); setCategory(""); setNotes("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const remove = (id: string) => persist(drafts.filter(d => d.id !== id));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Nova receita</p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-3">Adicionar fonte</h1>
        <p className="text-muted-foreground max-w-2xl">
          Cole aqui o link de um post, vídeo, PDF ou imagem. A receita fica salva como rascunho até ser{" "}
          <Link to="/validar" className="text-primary hover:underline">validada</Link>.
        </p>

        <form onSubmit={onSubmit} className="mt-8 bg-card border border-border/60 rounded-2xl p-6 md:p-7 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Tipo de fonte</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {sourceOptions.map(opt => {
                const Icon = opt.icon;
                const active = source === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSource(opt.value)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground/70 hover:border-primary/40"
                    }`}
                  >
                    <Icon size={18} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-foreground mb-2">
              Link ou URL da fonte <span className="text-primary">*</span>
            </label>
            <input
              id="sourceUrl"
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={current.placeholder}
              className="w-full px-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{current.hint}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">Título (opcional)</label>
              <input
                id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Bolo de fubá cremoso"
                className="w-full px-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">Categoria (opcional)</label>
              <input
                id="category" type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex.: Doces, Pães, Saladas..."
                className="w-full px-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">Notas (opcional)</label>
            <textarea
              id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações, adaptações ou lembretes..."
              className="w-full px-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {saved ? <span className="inline-flex items-center gap-1 text-primary font-medium"><Check size={14} /> Rascunho salvo</span> : "Salvo localmente no seu navegador"}
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              <Plus size={16} /> Salvar fonte
            </button>
          </div>
        </form>

        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-2xl font-bold">Rascunhos</h2>
            <span className="text-sm text-muted-foreground">{drafts.length} item{drafts.length === 1 ? "" : "s"}</span>
          </div>
          {drafts.length === 0 ? (
            <p className="text-muted-foreground text-sm bg-card border border-dashed border-border rounded-2xl p-6 text-center">
              Nenhum rascunho ainda. Adicione a primeira fonte acima.
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts.map(d => {
                const opt = sourceOptions.find(o => o.value === d.source)!;
                const Icon = opt.icon;
                return (
                  <li key={d.id} className="bg-card border border-border/60 rounded-2xl p-4 flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.category} • {opt.label}</p>
                      <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">
                        {d.sourceUrl}
                      </a>
                      {d.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">"{d.notes}"</p>}
                    </div>
                    <button
                      onClick={() => remove(d.id)}
                      className="shrink-0 p-2 text-muted-foreground hover:text-destructive transition"
                      aria-label="Remover rascunho"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
