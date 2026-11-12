import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquarePlus, PenLine, Send, Sparkles, Trash2 } from "lucide-react";
import Link from "@/components/link";
import { api, ApiClientError } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";
import { formatDate } from "@/components/features/bandora/panel/subscription/subscription-model";
import { CardSkeleton } from "@/components/features/bandora/panel/ui/states";
import { AssistantMarkdown } from "./assistant-markdown";
import {
  MIN_REVIEW_WORDS, TASK_MIN_WORDS, TASK_TYPES, countWords,
  type AssistantConversation, type AssistantMessage, type AssistantMode, type AssistantUsage, type TaskType,
} from "./assistant-model";

type UsageResponse = { tier: "free" | "premium"; usage: AssistantUsage; aiReady: boolean };
type SendResponse = { conversation: AssistantConversation; messages: AssistantMessage[]; usage: AssistantUsage };
type Failure = { message: string; quota: boolean };

/** `/app/assistant`: free questions and IELTS writing review in one conversation. */
export function AssistantPage() {
  const i18n = useT();
  const { t, locale } = i18n;
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [mode, setMode] = useState<AssistantMode>("chat");
  const [question, setQuestion] = useState("");
  const [essay, setEssay] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("task2");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [sending, setSending] = useState<AssistantMode | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);

  const fail = useCallback((caught: unknown) => {
    const quota = caught instanceof ApiClientError && caught.code === "quota_exhausted";
    setFailure({ message: errorText(caught, i18n), quota });
  }, [i18n]);

  useEffect(() => {
    let live = true;
    Promise.all([
      api.get<UsageResponse>("/api/assistant/usage"),
      api.get<{ conversations: AssistantConversation[] }>("/api/assistant/conversations"),
    ])
      .then(([usageBody, list]) => {
        if (!live) return;
        setUsage(usageBody);
        setConversations(list.conversations);
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function openConversation(id: string) {
    setFailure(null);
    try {
      const body = await api.get<{ messages: AssistantMessage[] }>(`/api/assistant/conversations/${id}`);
      setActiveId(id);
      setMessages(body.messages);
    } catch (caught) {
      fail(caught);
    }
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setFailure(null);
  }

  async function removeConversation(id: string) {
    if (!window.confirm(t("assistant.deleteConfirm"))) return;
    try {
      await api.delete(`/api/assistant/conversations/${id}`);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (activeId === id) newConversation();
    } catch (caught) {
      fail(caught);
    }
  }

  async function send(kind: AssistantMode) {
    const content = (kind === "chat" ? question : essay).trim();
    if (!content || sending) return;
    if (kind === "writing_review" && countWords(content) < MIN_REVIEW_WORDS) {
      setFailure({ message: t("assistant.review.minWords", { n: MIN_REVIEW_WORDS }), quota: false });
      return;
    }
    setFailure(null);
    setSending(kind);
    setPending(content);
    try {
      const body = await api.post<SendResponse>("/api/assistant/messages", kind === "chat"
        ? { conversationId: activeId ?? undefined, content }
        : { conversationId: activeId ?? undefined, kind, taskType, taskPrompt: taskPrompt.trim() || undefined, content });
      setMessages((list) => [...list, ...body.messages]);
      setActiveId(body.conversation.id);
      setConversations((list) => [body.conversation, ...list.filter((c) => c.id !== body.conversation.id)]);
      setUsage((current) => (current ? { ...current, usage: body.usage } : current));
      if (kind === "chat") setQuestion("");
      else {
        setEssay("");
        setTaskPrompt("");
        setMode("chat");
      }
    } catch (caught) {
      fail(caught);
    } finally {
      setSending(null);
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(mode);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void send(mode);
    }
  }

  if (!usage && !loadFailed) return <CardSkeleton />;

  const essayWords = countWords(essay);
  const exhausted = usage ? usage.usage.remaining <= 0 : false;
  const blocked = Boolean(sending) || (usage ? !usage.aiReady : false);

  return (
    <div className="bd-assistant">
      <section className="bd-card bd-stack bd-assistant__intro" aria-labelledby="assistant-title">
        <p className="bd-kicker">{t("assistant.kicker")}</p>
        <h2 id="assistant-title" className="bd-title">{t("assistant.title")}</h2>
        <p className="bd-sub">{t("assistant.body")}</p>
        {usage ? (
          <p className="bd-hint">
            {t("assistant.usage", { remaining: usage.usage.remaining, limit: usage.usage.limit })}
            {" · "}
            {t("assistant.usageReset", { date: formatDate(usage.usage.resetsAt, locale) })}
          </p>
        ) : null}
        {loadFailed ? <p className="bd-error" role="alert">{t("assistant.loadError")}</p> : null}
        {usage && !usage.aiReady ? <p className="bd-alert" role="status">{t("assistant.notReady")}</p> : null}
        {usage && exhausted ? (
          <p className="bd-alert bd-alert--info" role="status">
            {t("assistant.exhausted")}{" "}
            {usage.tier === "free" ? <Link href="/app/subscription">{t("assistant.upgrade")}</Link> : null}
          </p>
        ) : null}
      </section>

      <div className="bd-assistant__layout">
        <aside className="bd-card bd-assistant__history" aria-label={t("assistant.history")}>
          <button type="button" className="bd-btn bd-btn--outline bd-btn--block" onClick={newConversation}>
            <MessageSquarePlus size={16} strokeWidth={1.6} aria-hidden />
            {t("assistant.new")}
          </button>
          <p className="bd-legend">{t("assistant.history")}</p>
          {conversations.length === 0 ? <p className="bd-hint">{t("assistant.noHistory")}</p> : null}
          <ul className="bd-assistant__convs">
            {conversations.map((conversation) => (
              <li key={conversation.id} className={conversation.id === activeId ? "is-active" : undefined}>
                <button type="button" className="bd-assistant__conv" dir="auto" onClick={() => openConversation(conversation.id)}>
                  {conversation.title || t("assistant.untitled")}
                </button>
                <button type="button" className="bd-iconbtn" aria-label={t("assistant.delete")} onClick={() => removeConversation(conversation.id)}>
                  <Trash2 size={15} strokeWidth={1.6} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="bd-card bd-assistant__chat" aria-live="polite">
          <div className="bd-assistant__thread">
            {messages.length === 0 && !pending ? (
              <div className="bd-assistant__empty">
                <Sparkles size={22} strokeWidth={1.4} aria-hidden />
                <p className="bd-muted">{t("assistant.empty")}</p>
              </div>
            ) : null}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {pending ? (
              <>
                <article className="bd-msg bd-msg--user">
                  <p className="bd-msg__who">{t("assistant.you")}</p>
                  <p className="bd-msg__text" dir="auto">{pending}</p>
                </article>
                <p className="bd-assistant__thinking" role="status">
                  {sending === "writing_review" ? t("assistant.reviewing") : t("assistant.thinking")}
                </p>
              </>
            ) : null}
            <div ref={threadEnd} />
          </div>

          <form className="bd-assistant__composer" onSubmit={onSubmit}>
            <div className="bd-chips" role="group" aria-label={t("assistant.mode.label")}>
              <button type="button" className="bd-chip" aria-pressed={mode === "chat"} onClick={() => setMode("chat")}>
                {t("assistant.mode.chat")}
              </button>
              <button type="button" className="bd-chip" aria-pressed={mode === "writing_review"} onClick={() => setMode("writing_review")}>
                <PenLine size={15} strokeWidth={1.6} aria-hidden /> {t("assistant.mode.review")}
              </button>
            </div>

            {failure ? (
              <p className="bd-error" role="alert">
                <span>{failure.message}</span>
                {failure.quota ? <Link href="/app/subscription">{t("assistant.upgrade")}</Link> : null}
              </p>
            ) : null}

            {mode === "chat" ? (
              <div className="bd-field">
                <label htmlFor="assistant-question">{t("assistant.chat.label")}</label>
                <textarea
                  id="assistant-question"
                  className="bd-input bd-assistant__textarea"
                  dir="auto"
                  rows={3}
                  maxLength={8000}
                  value={question}
                  placeholder={t("assistant.chat.placeholder")}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <span className="bd-hint">{t("assistant.chat.hint")}</span>
              </div>
            ) : (
              <>
                <div className="bd-field">
                  <label htmlFor="assistant-task">{t("assistant.review.taskType")}</label>
                  <select id="assistant-task" className="bd-input" value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)}>
                    {TASK_TYPES.map((type) => <option key={type} value={type}>{t(`assistant.review.${type}`)}</option>)}
                  </select>
                </div>
                <div className="bd-field">
                  <label htmlFor="assistant-prompt">{t("assistant.review.prompt")}</label>
                  <textarea
                    id="assistant-prompt"
                    className="bd-input bd-input--ltr"
                    rows={2}
                    maxLength={2000}
                    value={taskPrompt}
                    placeholder={t("assistant.review.promptPlaceholder")}
                    onChange={(event) => setTaskPrompt(event.target.value)}
                  />
                </div>
                <div className="bd-field">
                  <label htmlFor="assistant-essay">{t("assistant.review.text")}</label>
                  <textarea
                    id="assistant-essay"
                    className="bd-input bd-input--ltr bd-assistant__textarea bd-assistant__essay"
                    rows={10}
                    maxLength={8000}
                    value={essay}
                    placeholder={t("assistant.review.textPlaceholder")}
                    onChange={(event) => setEssay(event.target.value)}
                    onKeyDown={onKeyDown}
                  />
                  <span className="bd-hint">
                    {t("assistant.review.words", { n: essayWords })}
                    {essayWords > 0 && essayWords < TASK_MIN_WORDS[taskType] ? ` · ${t("assistant.review.under", { n: TASK_MIN_WORDS[taskType] })}` : ""}
                  </span>
                </div>
              </>
            )}

            <button
              type="submit"
              className="bd-btn bd-btn--solid"
              disabled={blocked || exhausted || !(mode === "chat" ? question.trim() : essay.trim())}
            >
              {mode === "chat" ? <Send size={16} strokeWidth={1.6} aria-hidden /> : <PenLine size={16} strokeWidth={1.6} aria-hidden />}
              {sending ? t("assistant.sending") : mode === "chat" ? t("assistant.chat.send") : t("assistant.review.submit")}
            </button>
            {mode === "writing_review" ? <p className="bd-hint">{t("assistant.estimateNote")}</p> : null}
          </form>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const { t } = useT();
  if (message.role === "assistant") {
    return (
      <article className="bd-msg bd-msg--bot">
        <p className="bd-msg__who"><Sparkles size={14} strokeWidth={1.6} aria-hidden /> {t("assistant.bot")}</p>
        <AssistantMarkdown text={message.content} />
      </article>
    );
  }
  if (message.review) {
    return (
      <article className="bd-msg bd-msg--user">
        <p className="bd-msg__who">
          {t("assistant.review.badge")} · {t(`assistant.review.${message.review.taskType}`)} · {t("assistant.review.words", { n: message.review.wordCount })}
        </p>
        {message.review.taskPrompt ? <p className="bd-msg__task" dir="auto">{message.review.taskPrompt}</p> : null}
        <details>
          <summary>{t("assistant.review.show")}</summary>
          <p className="bd-msg__text" dir="ltr">{message.content}</p>
        </details>
      </article>
    );
  }
  return (
    <article className="bd-msg bd-msg--user">
      <p className="bd-msg__who">{t("assistant.you")}</p>
      <p className="bd-msg__text" dir="auto">{message.content}</p>
    </article>
  );
}
