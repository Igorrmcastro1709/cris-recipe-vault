import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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
type SavedStatus = Exclude<RecipeStatus, "nenhum">;

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

async function readRemote(userId: string): Promise<MetaMap> {
  const [ratingsResult, statusResult] = await Promise.all([
    supabase.from("ratings").select("recipe_id, rating").eq("user_id", userId),
    supabase.from("user_recipe_status").select("recipe_id, status").eq("user_id", userId),
  ]);

  if (ratingsResult.error) throw ratingsResult.error;
  if (statusResult.error) throw statusResult.error;

  const map: MetaMap = {};

  for (const row of ratingsResult.data ?? []) {
    map[row.recipe_id] = { ...empty, ...map[row.recipe_id], rating: row.rating };
  }

  for (const row of statusResult.data ?? []) {
    map[row.recipe_id] = {
      ...empty,
      ...map[row.recipe_id],
      status: row.status as SavedStatus,
    };
  }

  return map;
}

async function persistRating(userId: string, recipeId: string, rating: number) {
  if (rating <= 0) {
    const { error } = await supabase
      .from("ratings")
      .delete()
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("ratings").upsert(
    {
      user_id: userId,
      recipe_id: recipeId,
      rating,
    },
    { onConflict: "recipe_id,user_id" },
  );
  if (error) throw error;
}

async function persistStatus(userId: string, recipeId: string, status: RecipeStatus) {
  if (status === "nenhum") {
    const { error } = await supabase
      .from("user_recipe_status")
      .delete()
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("user_recipe_status").upsert(
    {
      user_id: userId,
      recipe_id: recipeId,
      status,
    },
    { onConflict: "recipe_id,user_id" },
  );
  if (error) throw error;
}

export function useAllUserMeta(): MetaMap {
  const { user } = useAuth();
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

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    readRemote(user.id)
      .then((remote) => {
        if (cancelled) return;
        write(remote);
        setMap(remote);
      })
      .catch((err) => {
        console.warn("Não foi possível carregar marcações do usuário.", err);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return map;
}

export function useRecipeMeta(id: string) {
  const { user } = useAuth();
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

      if (user) {
        if (patch.rating !== undefined) {
          persistRating(user.id, id, patch.rating).catch((err) => {
            console.warn("Não foi possível salvar a nota.", err);
          });
        }
        if (patch.status !== undefined) {
          persistStatus(user.id, id, patch.status).catch((err) => {
            console.warn("Não foi possível salvar o status.", err);
          });
        }
      }
    },
    [id, user],
  );

  const setStatus = useCallback((status: RecipeStatus) => update({ status }), [update]);

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

  const markCooked = useCallback(() => update({ status: "ja-fiz", cooked: Date.now() }), [update]);

  return { meta, setStatus, toggleStatus, setRating, markCooked };
}

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  nenhum: "Sem marcação",
  "quero-testar": "Quero testar",
  "ja-fiz": "Já fiz",
  favorita: "Favorita",
};
