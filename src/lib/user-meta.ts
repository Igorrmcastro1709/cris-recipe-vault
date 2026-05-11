import { useCallback, useEffect, useState } from "react";

export type RecipeStatus = "nenhum" | "quero-testar" | "ja-fiz" | "favorita";

export interface RecipeMeta {
  status: RecipeStatus;
  rating: number; // 0–5, 0 = sem nota
  cooked?: number; // timestamp da última vez
}

export type MetaMap = Record<string, RecipeMeta>;

const STORAGE_KEY = "receitas-da-cris:user-meta";
const EVENT = "receitas-da-cris:user-meta:change";

const empty: RecipeMeta = { status: "nenhum", rating: 0 };

function read(): MetaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MetaMap) : {};
  } catch {
    return {};
  }
}

function write(map: MetaMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
}

export function useAllUserMeta(): MetaMap {
  const [map, setMap] = useState<MetaMap>(() => read());
  useEffect(() => {
    const sync = () => setMap(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return map;
}

export function useRecipeMeta(id: string) {
  const all = useAllUserMeta();
  const meta = all[id] ?? empty;

  const update = useCallback(
    (patch: Partial<RecipeMeta>) => {
      const current = read();
      const next: MetaMap = {
        ...current,
        [id]: { ...empty, ...current[id], ...patch },
      };
      write(next);
    },
    [id],
  );

  const setStatus = useCallback(
    (status: RecipeStatus) => update({ status }),
    [update],
  );

  const toggleStatus = useCallback(
    (status: Exclude<RecipeStatus, "nenhum">) => {
      const current = read()[id] ?? empty;
      update({ status: current.status === status ? "nenhum" : status });
    },
    [id, update],
  );

  const setRating = useCallback(
    (rating: number) => update({ rating: Math.max(0, Math.min(5, rating)) }),
    [update],
  );

  const markCooked = useCallback(
    () => update({ status: "ja-fiz", cooked: Date.now() }),
    [update],
  );

  return { meta, setStatus, toggleStatus, setRating, markCooked };
}

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  nenhum: "Sem marcação",
  "quero-testar": "Quero testar",
  "ja-fiz": "Já fiz",
  favorita: "Favorita",
};
