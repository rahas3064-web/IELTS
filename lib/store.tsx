"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todayIso } from "@/lib/format";
import { buildView, overallBand, placementProgress, scenarioById, scorePlacement, sourceFromScenario, sourceFromSelf, type LearnerView } from "@/lib/model";
import { SCENARIOS, type ScenarioId } from "@/lib/scenarios";
import type {
  Account,
  AppState,
  Connection,
  ExamTiming,
  LabOverrides,
  Locale,
  PlacementState,
  PlanPath,
  ProductEvent,
  Profile,
  PublishStatus,
  Role,
  Skill,
  SkillBands,
  TaskEdit,
  TextScale,
  Ticket,
} from "@/lib/types";

const KEY = "ielts-readiness-state";

export const emptyPlacement = (): PlacementState => ({
  startedAt: null,
  answers: {},
  writing1: "",
  writing2: "",
  speaking: {},
  speakingRecorded: {},
  done: {},
});

export const emptyBands = (): SkillBands => ({ listening: 6, reading: 6, writing: 6, speaking: 6 });

function profileFromScenario(id: ScenarioId): Profile {
  const scenario = SCENARIOS[id];
  return {
    name: scenario.person.fa,
    email: id === "A" ? "armin@example.com" : id === "B" ? "negar@example.com" : "kian@example.com",
    phone: "09120000000",
    age: id === "A" ? 24 : id === "B" ? 27 : 31,
    examType: scenario.examType,
    reason: scenario.reason,
    reasonNote: scenario.reasonNote.fa,
    selfBand: overallBand(scenario.bands),
    previousOverall: null,
    targetOverall: scenario.targetOverall,
    targetSkills: scenario.targetSkills,
    timing: { kind: "date", date: new Date(Date.now() + scenario.examOffsetDays * 86400000).toISOString().slice(0, 10) },
    dailyMinutes: scenario.dailyMinutes,
    daysPerWeek: scenario.daysPerWeek,
    suggestedOverall: scenario.suggestedOverall,
  };
}

export function defaultState(): AppState {
  return {
    locale: "fa",
    textScale: "md",
    reducedMotion: false,
    account: null,
    accounts: [],
    onboardingDone: false,
    profile: null,
    dataSource: "self",
    placement: emptyPlacement(),
    labOverrides: null,
    savedLabs: [],
    planPath: "auto",
    taskEdits: {},
    exerciseAttempts: [],
    mockAttempts: [],
    notificationReads: [],
    notificationPrefs: { motivation: true, daily: true, plan: true, performance: true },
    tickets: [],
    questionStatus: {},
    deliveryStatus: {},
    events: [],
    securityEvents: [],
    connection: "online",
    consentAnalytics: false,
    consentAt: null,
  };
}

function mergeState(raw: Partial<AppState>): AppState {
  const base = defaultState();
  return {
    ...base,
    ...raw,
    placement: { ...base.placement, ...raw.placement },
    notificationPrefs: { ...base.notificationPrefs, ...raw.notificationPrefs },
    accounts: raw.accounts ?? [],
    events: raw.events ?? [],
    securityEvents: raw.securityEvents ?? [],
    tickets: raw.tickets ?? [],
    exerciseAttempts: raw.exerciseAttempts ?? [],
    mockAttempts: raw.mockAttempts ?? [],
    savedLabs: raw.savedLabs ?? [],
    taskEdits: raw.taskEdits ?? {},
    questionStatus: raw.questionStatus ?? {},
    deliveryStatus: raw.deliveryStatus ?? {},
    notificationReads: raw.notificationReads ?? [],
  };
}

type StoreValue = {
  ready: boolean;
  state: AppState;
  view: LearnerView | null;
  bi: (fa: string, en: string) => string;
  setLocale: (locale: Locale) => void;
  setTextScale: (scale: TextScale) => void;
  setReducedMotion: (value: boolean) => void;
  setConnection: (connection: Connection) => void;
  setConsent: (value: boolean) => void;
  signUp: (account: Account) => void;
  signInExisting: (email: string) => boolean;
  signInDemo: (kind: "learner" | "admin") => void;
  signOut: () => void;
  setRole: (role: Role) => void;
  saveProfile: (profile: Profile) => void;
  patchPlacement: (patch: Partial<PlacementState>) => void;
  setAnswer: (id: string, value: string) => void;
  setSpeaking: (id: string, value: string, seconds?: number) => void;
  completeSkill: (skill: Skill) => void;
  setDataSource: (source: AppState["dataSource"]) => void;
  setOverrides: (overrides: LabOverrides | null) => void;
  saveLab: (name: string) => void;
  loadLab: (id: string) => void;
  deleteLab: (id: string) => void;
  setPlanPath: (path: PlanPath | "auto") => void;
  editTask: (id: string, edit: TaskEdit) => void;
  applyRebalance: (mode: "shrink" | "drop-low") => void;
  completeExercise: (exerciseId: string, skill: Skill, correct: number, total: number) => void;
  saveMock: (mockId: string, bands: SkillBands, correct: number, total: number, answers: Record<string, string>) => void;
  markNotice: (id: string) => void;
  setNoticePref: (key: keyof AppState["notificationPrefs"], value: boolean) => void;
  addTicket: (ticket: Omit<Ticket, "id" | "createdAt" | "status"> & { status?: Ticket["status"] }) => string;
  setTicketStatus: (id: string, status: Ticket["status"]) => void;
  setQuestionStatus: (id: string, status: PublishStatus) => void;
  setDeliveryStatus: (id: string, status: AppState["deliveryStatus"][string]) => void;
  track: (name: string, props?: ProductEvent["props"]) => void;
  logSecurity: (name: AppState["securityEvents"][number]["name"], detail: string) => void;
  resetWorkspace: () => void;
  deleteLocalAccount: () => void;
  waitForConnection: () => Promise<"ok" | "offline">;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        setState(mergeState(JSON.parse(raw) as Partial<AppState>));
      } catch {
        setState(defaultState());
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(state));
    document.documentElement.lang = state.locale === "fa" ? "fa" : "en";
    document.documentElement.dir = state.locale === "fa" ? "rtl" : "ltr";
    document.documentElement.dataset.text = state.textScale;
    document.documentElement.dataset.motion = state.reducedMotion ? "reduce" : "full";
  }, [state, ready]);

  const view = useMemo(() => {
    const today = todayIso();
    if (state.dataSource === "self") {
      if (!state.profile) return null;
      const source = sourceFromSelf({
        profile: state.profile,
        placement: state.placement,
        overrides: state.labOverrides,
        today,
        exerciseCount: state.exerciseAttempts.length,
        mockCount: state.mockAttempts.length,
      });
      if (!source) return null;
      return buildView(source, { path: state.planPath, edits: state.taskEdits, today });
    }
    const source = sourceFromScenario(scenarioById(state.dataSource), state.labOverrides, today);
    return buildView(source, { path: state.planPath, edits: state.taskEdits, today });
  }, [state]);

  const patch = (partial: Partial<AppState> | ((current: AppState) => AppState)) => {
    setState((current) => (typeof partial === "function" ? partial(current) : { ...current, ...partial }));
  };

  const track = (name: string, props: ProductEvent["props"] = {}) => {
    setState((current) => {
      if (!current.consentAnalytics) return current;
      return {
        ...current,
        events: [...current.events, { name, at: new Date().toISOString(), props }].slice(-200),
      };
    });
  };

  const value: StoreValue = {
    ready,
    state,
    view,
    bi: (fa, en) => (state.locale === "fa" ? fa : en),
    setLocale: (locale) => patch({ locale }),
    setTextScale: (textScale) => patch({ textScale }),
    setReducedMotion: (reducedMotion) => patch({ reducedMotion }),
    setConnection: (connection) => patch({ connection }),
    setConsent: (consentAnalytics) => {
      setState((current) => ({
        ...current,
        consentAnalytics,
        consentAt: new Date().toISOString(),
        securityEvents: [...current.securityEvents, { name: "consent_change", at: new Date().toISOString(), detail: String(consentAnalytics) }],
      }));
    },
    signUp: (account) => {
      setState((current) => ({
        ...current,
        account,
        accounts: [...current.accounts.filter((item) => item.email !== account.email), account],
        onboardingDone: false,
        profile: null,
        dataSource: "self",
        placement: emptyPlacement(),
        labOverrides: null,
        taskEdits: {},
        securityEvents: [...current.securityEvents, { name: "login", at: new Date().toISOString(), detail: "signup" }],
        events: current.consentAnalytics
          ? [...current.events, { name: "signup_completed", at: new Date().toISOString(), props: { method: "form" } }]
          : current.events,
      }));
    },
    signInExisting: (email) => {
      const account = state.accounts.find((item) => item.email.toLowerCase() === email.toLowerCase());
      if (!account) return false;
      patch({
        account,
        securityEvents: [...state.securityEvents, { name: "login", at: new Date().toISOString(), detail: "existing" }],
      });
      return true;
    },
    signInDemo: (kind) => {
      const account: Account = kind === "admin"
        ? { name: "مدیر نمونه", email: "admin@example.com", phone: "09120000002", age: 34, role: "system_admin" }
        : { name: "نگار حسینی", email: "negar@example.com", phone: "09120000000", age: 27, role: "learner" };
      setState((current) => ({
        ...current,
        account,
        accounts: [...current.accounts.filter((item) => item.email !== account.email), account],
        onboardingDone: true,
        profile: profileFromScenario("B"),
        dataSource: "B",
        placement: emptyPlacement(),
        labOverrides: null,
        taskEdits: {},
        consentAnalytics: true,
        consentAt: new Date().toISOString(),
        securityEvents: [...current.securityEvents, { name: "login", at: new Date().toISOString(), detail: kind }],
      }));
    },
    signOut: () => {
      setState((current) => ({
        ...current,
        account: null,
        securityEvents: [...current.securityEvents, { name: "logout", at: new Date().toISOString(), detail: "manual" }],
      }));
    },
    setRole: (role) => {
      if (!state.account) return;
      patch({ account: { ...state.account, role } });
    },
    saveProfile: (profile) => {
      const first = !state.onboardingDone;
      setState((current) => ({
        ...current,
        profile,
        onboardingDone: true,
        dataSource: "self",
        events: current.consentAnalytics && first
          ? [...current.events, { name: "onboarding_completed", at: new Date().toISOString(), props: { examType: profile.examType, hasDate: profile.timing.kind === "date" } }]
          : current.events,
      }));
    },
    patchPlacement: (partial) => patch({ placement: { ...state.placement, ...partial } }),
    setAnswer: (id, answer) => patch({ placement: { ...state.placement, answers: { ...state.placement.answers, [id]: answer } } }),
    setSpeaking: (id, answer, seconds) => patch({
      placement: {
        ...state.placement,
        speaking: { ...state.placement.speaking, [id]: answer },
        speakingRecorded: seconds ? { ...state.placement.speakingRecorded, [id]: seconds } : state.placement.speakingRecorded,
      },
    }),
    completeSkill: (skill) => {
      setState((current) => {
        const placement = {
          ...current.placement,
          startedAt: current.placement.startedAt ?? new Date().toISOString(),
          done: { ...current.placement.done, [skill]: new Date().toISOString() },
        };
        const finished = placementProgress(placement) === 4;
        const score = finished ? scorePlacement(placement) : null;
        const overall = score ? overallBand(score.bands) : 0;
        const bandBucket = overall < 5 ? "under-5" : overall < 6 ? "5-to-6" : overall < 7 ? "6-to-7" : "7-plus";
        return {
          ...current,
          placement,
          dataSource: finished ? "self" : current.dataSource,
          events: current.consentAnalytics
            ? [...current.events, finished
                ? { name: "placement_test_completed", at: new Date().toISOString(), props: { bandBucket } }
                : { name: "placement_test_started", at: new Date().toISOString(), props: { skill } }]
            : current.events,
        };
      });
    },
    setDataSource: (dataSource) => patch({ dataSource, labOverrides: null }),
    setOverrides: (labOverrides) => patch({ labOverrides }),
    saveLab: (name) => patch({
      savedLabs: [...state.savedLabs, { id: `lab-${Date.now()}`, name, base: state.dataSource, overrides: state.labOverrides ?? {} }],
    }),
    loadLab: (id) => {
      const saved = state.savedLabs.find((item) => item.id === id);
      if (!saved) return;
      patch({ dataSource: saved.base, labOverrides: saved.overrides });
    },
    deleteLab: (id) => patch({ savedLabs: state.savedLabs.filter((item) => item.id !== id) }),
    setPlanPath: (planPath) => patch({ planPath }),
    editTask: (id, edit) => patch({ taskEdits: { ...state.taskEdits, [id]: { ...state.taskEdits[id], ...edit } } }),
    applyRebalance: (mode) => {
      if (!view) return;
      const next = { ...state.taskEdits };
      for (const task of view.plan.tasks) {
        if (mode === "drop-low" && task.priority === "low") next[task.id] = { ...next[task.id], status: "skipped" };
        if (mode === "shrink" && task.priority !== "high") next[task.id] = { ...next[task.id], minutes: Math.max(10, Math.round(task.minutes * 0.7)) };
      }
      patch({ taskEdits: next });
    },
    completeExercise: (exerciseId, skill, correct, total) => {
      setState((current) => ({
        ...current,
        exerciseAttempts: [...current.exerciseAttempts, { id: `ex-${Date.now()}`, exerciseId, skill, at: new Date().toISOString(), correct, total }],
        events: current.consentAnalytics
          ? [...current.events, { name: "exercise_completed", at: new Date().toISOString(), props: { skill, exerciseId } }]
          : current.events,
      }));
    },
    saveMock: (mockId, bands, correct, total, answers) => {
      setState((current) => ({
        ...current,
        mockAttempts: [...current.mockAttempts, { id: `mock-${Date.now()}`, mockId, at: new Date().toISOString(), bands, correct, total, answers }],
        events: current.consentAnalytics
          ? [...current.events, { name: "mock_test_completed", at: new Date().toISOString(), props: { scope: mockId } }]
          : current.events,
      }));
    },
    markNotice: (id) => patch({ notificationReads: state.notificationReads.includes(id) ? state.notificationReads : [...state.notificationReads, id] }),
    setNoticePref: (key, pref) => patch({ notificationPrefs: { ...state.notificationPrefs, [key]: pref } }),
    addTicket: (ticket) => {
      const id = `t-${Date.now()}`;
      setState((current) => ({
        ...current,
        tickets: [{ ...ticket, id, status: ticket.status ?? "open", createdAt: new Date().toISOString() }, ...current.tickets],
        events: current.consentAnalytics
          ? [...current.events, { name: "feedback_submitted", at: new Date().toISOString(), props: { kind: ticket.kind } }]
          : current.events,
      }));
      return id;
    },
    setTicketStatus: (id, status) => patch({ tickets: state.tickets.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket)) }),
    setQuestionStatus: (id, status) => patch({ questionStatus: { ...state.questionStatus, [id]: status } }),
    setDeliveryStatus: (id, status) => patch({ deliveryStatus: { ...state.deliveryStatus, [id]: status } }),
    track,
    logSecurity: (name, detail) => patch({ securityEvents: [...state.securityEvents, { name, at: new Date().toISOString(), detail }] }),
    resetWorkspace: () => {
      const account = state.account;
      const accounts = state.accounts;
      const locale = state.locale;
      setState({ ...defaultState(), account, accounts, locale, textScale: state.textScale, reducedMotion: state.reducedMotion });
    },
    deleteLocalAccount: () => {
      localStorage.removeItem(KEY);
      setState(defaultState());
    },
    waitForConnection: async () => {
      if (state.connection === "offline") return "offline";
      if (state.connection === "slow") await new Promise((resolve) => setTimeout(resolve, 900));
      return "ok";
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useApp must be used inside StoreProvider");
  return value;
}

export type { ExamTiming };
