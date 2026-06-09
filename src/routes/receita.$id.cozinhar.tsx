import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Mic,
  MicOff,
  Square,
  Timer,
} from "lucide-react";
import { Header } from "@/components/Header";
import { fetchRecipeById } from "@/lib/recipes";
import { useAuth } from "@/lib/auth";
import { useRecipeMeta } from "@/lib/user-meta";

export const Route = createFileRoute("/receita/$id/cozinhar")({
  head: () => ({
    meta: [{ title: "Modo cozinha — Receitas da Cris" }],
  }),
  component: CookRoute,
});

function CookRoute() {
  const { id } = Route.useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const {
    data: recipe,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["recipe", id, isAdmin],
    queryFn: () => fetchRecipeById(id, { includeDrafts: isAdmin }),
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Preparando modo cozinha…
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="font-serif text-3xl font-bold mb-3">Receita não encontrada</h1>
          <Link to="/" className="text-primary font-medium hover:underline">
            ← Voltar ao catálogo
          </Link>
        </div>
      </div>
    );
  }

  return <CookMode recipe={recipe} />;
}

function CookMode({
  recipe,
}: {
  recipe: NonNullable<Awaited<ReturnType<typeof fetchRecipeById>>>;
}) {
  const navigate = useNavigate();
  const { markCooked } = useRecipeMeta(recipe.id);
  const storageKey = `receitas-da-cris:cook:${recipe.id}`;
  const [stepIndex, setStepIndex] = useState(() => readProgress(storageKey));
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [voicesReady, setVoicesReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceCommandError, setVoiceCommandError] = useState("");
  const [lastVoiceCommand, setLastVoiceCommand] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isListeningRef = useRef(false);
  const stepIndexRef = useRef(stepIndex);

  const totalSteps = Math.max(recipe.steps.length, 1);
  const currentStep = recipe.steps[stepIndex] ?? "Esta receita ainda nao tem passos cadastrados.";
  const suggestedSeconds = useMemo(() => detectTimeInSeconds(currentStep), [currentStep]);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const voiceCommandsSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(stepIndex));
  }, [storageKey, stepIndex]);

  useEffect(() => {
    setTimerSeconds(0);
    setTimerRunning(false);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!speechSupported) {
      setSpeechError("Este navegador não liberou a leitura em voz alta.");
      return;
    }
    const loadVoices = () => setVoicesReady(window.speechSynthesis.getVoices().length > 0);
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [speechSupported]);

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const id = window.setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, timerSeconds]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  const speak = useCallback(
    (text = currentStep) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setSpeechError("Este navegador não liberou a leitura em voz alta.");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const portugueseVoice =
        voices.find((voice) => voice.lang.toLowerCase() === "pt-br") ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("pt")) ??
        null;
      if (portugueseVoice) utterance.voice = portugueseVoice;
      utterance.lang = portugueseVoice?.lang ?? "pt-BR";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.onstart = () => {
        setSpeechError("");
        setIsSpeaking(true);
        setIsPaused(false);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeechError(
          "Não consegui tocar o áudio. Toque em “Ler passo” novamente ou verifique o volume do navegador.",
        );
      };
      setSpeechError("");
      window.speechSynthesis.speak(utterance);
    },
    [currentStep],
  );

  const pauseOrResume = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechError("Este navegador não liberou a leitura em voz alta.");
      return;
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
      setIsPaused(false);
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
      setIsPaused(true);
    }
  };

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const goToStep = (next: number) => {
    setStepIndex(Math.min(Math.max(next, 0), totalSteps - 1));
  };

  const conclude = () => {
    stopSpeaking();
    markCooked();
    localStorage.removeItem(storageKey);
    navigate({ to: "/receita/$id", params: { id: recipe.id } });
  };

  const startTimer = () => {
    setTimerSeconds(timerSeconds > 0 ? timerSeconds : suggestedSeconds);
    setTimerRunning(true);
  };

  const handleVoiceCommand = useCallback(
    (transcript: string) => {
      const text = normalizeCommand(transcript);
      setLastVoiceCommand(transcript);
      if (text.includes("proximo") || text.includes("avancar") || text.includes("seguinte")) {
        const nextIndex = Math.min(stepIndexRef.current + 1, totalSteps - 1);
        setStepIndex(nextIndex);
        speak(recipe.steps[nextIndex] ?? currentStep);
        return;
      }
      if (text.includes("anterior") || text.includes("voltar")) {
        const nextIndex = Math.max(stepIndexRef.current - 1, 0);
        setStepIndex(nextIndex);
        speak(recipe.steps[nextIndex] ?? currentStep);
        return;
      }
      if (text.includes("repetir") || text.includes("ler") || text.includes("novamente")) {
        speak(recipe.steps[stepIndexRef.current] ?? currentStep);
        return;
      }
      if (text.includes("pausar") || text.includes("pause")) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          setIsSpeaking(false);
          setIsPaused(true);
        }
        return;
      }
      if (text.includes("continuar") || text.includes("retomar")) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsSpeaking(true);
          setIsPaused(false);
        }
        return;
      }
      if (text.includes("parar") || text.includes("cancelar")) {
        stopSpeaking();
      }
    },
    [currentStep, recipe.steps, speak, stopSpeaking, totalSteps],
  );

  const toggleVoiceCommands = () => {
    if (!voiceCommandsSupported) {
      setVoiceCommandError("Seu navegador não liberou comandos por voz.");
      return;
    }
    if (isListeningRef.current) {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setVoiceCommandError("Seu navegador não liberou comandos por voz.");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => {
      setVoiceCommandError("");
      setIsListening(true);
      isListeningRef.current = true;
    };
    recognition.onerror = () => {
      setVoiceCommandError(
        "Não consegui ouvir comandos. Verifique a permissão do microfone e tente novamente.",
      );
      setIsListening(false);
      isListeningRef.current = false;
    };
    recognition.onend = () => {
      const shouldRestart = isListeningRef.current;
      setIsListening(false);
      if (shouldRestart) {
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
          }
        }, 250);
      }
    };
    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const lastResult = results.at(-1);
      const transcript = lastResult?.[0]?.transcript?.trim();
      if (transcript) handleVoiceCommand(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/receita/$id"
            params={{ id: recipe.id }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Voltar para receita
          </Link>
          <span className="text-sm text-muted-foreground">
            Passo {stepIndex + 1} de {totalSteps}
          </span>
        </div>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
          <div className="rounded-2xl bg-card border border-border/60 p-6 md:p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
              Cozinhando agora
            </p>
            <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight">
              {recipe.title}
            </h1>

            <div className="mt-8 rounded-2xl bg-background border border-border p-6 md:p-8 min-h-64 flex flex-col justify-center">
              <p className="text-sm font-semibold text-primary mb-3">Passo {stepIndex + 1}</p>
              <p className="text-2xl md:text-4xl leading-relaxed font-semibold text-foreground">
                {currentStep}
              </p>
            </div>

            {suggestedSeconds > 0 && (
              <div className="mt-5 rounded-2xl bg-accent/40 border border-border/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold inline-flex items-center gap-2">
                    <Timer size={16} aria-hidden="true" /> Timer sugerido
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Detectei {formatSeconds(suggestedSeconds)} neste passo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {timerSeconds > 0 && (
                    <span className="font-mono text-lg font-bold">
                      {formatSeconds(timerSeconds)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={timerRunning ? () => setTimerRunning(false) : startTimer}
                    className="inline-flex items-center gap-2 bg-background border border-border px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition"
                  >
                    {timerRunning ? <Pause size={15} /> : <Play size={15} />}
                    {timerRunning ? "Pausar" : "Iniciar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerSeconds(0);
                    }}
                    className="inline-flex items-center gap-2 bg-background border border-border px-3 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition"
                    aria-label="Zerar timer"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-primary/5 border border-primary/20 p-4">
              <p className="text-sm font-semibold text-foreground mb-1">Assistente de voz</p>
              <p className="text-sm text-muted-foreground">
                Primeiro toque em “Ler passo” para liberar o áudio. Depois você pode usar comandos
                como “próximo”, “anterior”, “repetir”, “pausar” e “continuar”.
              </p>
              {!voicesReady && speechSupported && (
                <p className="mt-2 text-sm text-muted-foreground">Carregando vozes do navegador…</p>
              )}
              {speechError && <p className="mt-2 text-sm text-red-600">{speechError}</p>}
              {voiceCommandError && (
                <p className="mt-2 text-sm text-red-600">{voiceCommandError}</p>
              )}
              {lastVoiceCommand && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Último comando ouvido: “{lastVoiceCommand}”
                </p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => goToStep(stepIndex - 1)}
                disabled={stepIndex === 0}
                className="inline-flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 rounded-xl font-semibold hover:bg-muted transition disabled:opacity-50"
              >
                <ChevronLeft size={18} /> Anterior
              </button>
              <button
                type="button"
                onClick={() => speak()}
                disabled={!speechSupported}
                className="inline-flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 rounded-xl font-semibold hover:bg-muted transition"
              >
                <RotateCcw size={18} /> Ler passo
              </button>
              <button
                type="button"
                onClick={pauseOrResume}
                disabled={!speechSupported}
                className="inline-flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 rounded-xl font-semibold hover:bg-muted transition"
              >
                {isSpeaking ? <Pause size={18} /> : <Play size={18} />}{" "}
                {isSpeaking ? "Pausar" : isPaused ? "Continuar" : "Pausar"}
              </button>
              <button
                type="button"
                onClick={stopSpeaking}
                disabled={!speechSupported}
                className="inline-flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 rounded-xl font-semibold hover:bg-muted transition"
              >
                <Square size={16} /> Parar
              </button>
              {stepIndex < totalSteps - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextIndex = Math.min(stepIndex + 1, totalSteps - 1);
                    goToStep(nextIndex);
                    speak(recipe.steps[nextIndex]);
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl font-semibold hover:opacity-90 transition col-span-2 md:col-span-1"
                >
                  Próximo <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={conclude}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl font-semibold hover:opacity-90 transition col-span-2 md:col-span-1"
                >
                  <CheckCircle2 size={18} /> Concluir
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={toggleVoiceCommands}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 border border-border bg-background px-4 py-3 rounded-xl font-semibold hover:bg-muted transition"
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              {isListening ? "Parar comandos por voz" : "Ativar comandos por voz"}
            </button>
          </div>

          <aside className="rounded-2xl bg-card border border-border/60 p-5 self-start lg:sticky lg:top-24">
            <h2 className="font-serif text-xl font-bold mb-4">Ingredientes</h2>
            {recipe.ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem ingredientes cadastrados.</p>
            ) : (
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={`${ingredient}-${index}`} className="text-sm leading-relaxed">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 w-5 h-5 rounded-md border-border accent-primary"
                      />
                      <span>{ingredient}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return (
    (window as WindowWithSpeechRecognition).SpeechRecognition ??
    (window as WindowWithSpeechRecognition).webkitSpeechRecognition ??
    null
  );
}

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function normalizeCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readProgress(storageKey: string) {
  if (typeof window === "undefined") return 0;
  const value = Number(localStorage.getItem(storageKey));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function detectTimeInSeconds(text: string) {
  const match = text.match(/(\d+)\s*(segundos?|minutos?|mins?|min|horas?|h)\b/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount)) return 0;
  if (unit.startsWith("seg")) return amount;
  if (unit.startsWith("h")) return amount * 3600;
  return amount * 60;
}

function formatSeconds(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  if (minutes > 0) return `${minutes}min ${seconds.toString().padStart(2, "0")}s`;
  return `${seconds}s`;
}
