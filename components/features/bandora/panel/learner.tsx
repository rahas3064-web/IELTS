import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LearnerTask = { id: string; title: string; minutes: number; done: boolean };
export type LearnerSkills = { listening: number | null; reading: number | null; writing: number | null; speaking: number | null };
export type Learner = {
  name: string;
  focus: string;
  cefr: string;
  band: number | null;
  target: number | null;
  tasks: LearnerTask[];
  skills: LearnerSkills;
};

function emptyLearner(): Learner {
  return {
    name: "",
    focus: "",
    cefr: "",
    band: null,
    target: null,
    tasks: [],
    skills: { listening: null, reading: null, writing: null, speaking: null },
  };
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

type LearnerValue = {
  learner: Learner;
  ready: boolean;
  status: SaveStatus;
  save: (next: unknown) => Promise<boolean>;
};

const LearnerContext = createContext<LearnerValue | null>(null);

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner>(emptyLearner());
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    let active = true;
    fetch("/api/learner")
      .then((response) => response.json())
      .then((body) => {
        if (!active) return;
        setLearner(body?.learner ?? emptyLearner());
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (next: unknown) => {
    setStatus("saving");
    try {
      const response = await fetch("/api/learner", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        setStatus("error");
        return false;
      }
      const body = await response.json();
      setLearner(body.learner ?? next);
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, []);

  const value = useMemo(() => ({ learner, ready, status, save }), [learner, ready, status, save]);
  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner() {
  const value = useContext(LearnerContext);
  if (!value) throw new Error("useLearner must be used inside the Bandora panel");
  return value;
}
