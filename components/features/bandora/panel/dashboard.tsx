import Link from "@/components/link";
import { toFa } from "@/components/features/bandora/content";
import { useSession } from "@/components/features/bandora/panel/session";
import { usePanelLocale } from "@/components/features/bandora/panel/locale";
import {
  SKILL_FIELDS,
  formatBand,
  greeting,
  levelProgress,
  readAccount,
  type AccountFact,
  type AttemptCount,
} from "@/components/features/bandora/panel/model";

function BoxHead({ id, title }: { id: string; title: string }) {
  return (
    <div className="bd-head">
      <h2 id={id}>{title}</h2>
    </div>
  );
}

function countText(count: AttemptCount, locale: "fa" | "en") {
  const correct = locale === "fa" ? toFa(count.correct) : String(count.correct);
  const total = locale === "fa" ? toFa(count.total) : String(count.total);
  return `${correct} / ${total}`;
}

function factText(fact: AccountFact, copy: { academic: string; general: string }, locale: "fa" | "en") {
  if (fact.id === "exam") return fact.value === "academic" ? copy.academic : copy.general;
  if (typeof fact.value === "number") {
    const shown = fact.id === "target" ? formatBand(fact.value, locale) : locale === "fa" ? toFa(fact.value) : String(fact.value);
    return shown;
  }
  return fact.value;
}

export function BandoraDashboard() {
  const { me, ready } = useSession();
  const { locale, copy } = usePanelLocale();
  const account = readAccount(me);

  if (!ready) {
    return (
      <div className="bd-skeleton" aria-hidden="true">
        <section className="bd-card"><span className="bd-skel bd-skel-title" /><span className="bd-skel" /></section>
      </div>
    );
  }

  if (!account) {
    return (
      <section className="bd-card" aria-labelledby="hello-title">
        <BoxHead id="hello-title" title={copy.signInLead} />
        <p className="bd-meta">{copy.empty}</p>
        <div className="bd-actions">
          <Link className="bd-btn bd-btn-solid" href="/login?next=/app">{copy.signIn}</Link>
          <Link className="bd-btn bd-btn-line" href="/signup">{copy.signUp}</Link>
        </div>
      </section>
    );
  }

  const labels: Record<AccountFact["id"], string> = {
    email: copy.email,
    phone: copy.phone,
    age: copy.age,
    exam: copy.exam,
    target: copy.target,
    minutes: copy.daily,
    days: copy.days,
  };
  const hasGoal = account.facts.some((fact) => fact.id === "exam" || fact.id === "target");
  const progress = account.overall != null && account.target != null ? levelProgress(account.overall, account.target) : 0;
  const stats = [
    account.stats.listening ? { id: "listening", label: copy.listeningCorrect, value: countText(account.stats.listening, locale) } : null,
    account.stats.reading ? { id: "reading", label: copy.readingCorrect, value: countText(account.stats.reading, locale) } : null,
    account.stats.mockCount > 0 ? { id: "mocks", label: copy.mockCount, value: locale === "fa" ? toFa(account.stats.mockCount) : String(account.stats.mockCount) } : null,
    account.stats.lastMock ? { id: "last", label: copy.lastMock, value: countText(account.stats.lastMock, locale) } : null,
  ].filter((row) => row !== null);

  return (
    <div className="t-reveal">
      <section className="bd-card" aria-labelledby="hello-title">
        <BoxHead id="hello-title" title={greeting(locale, account.name, new Date().getHours())} />
        {account.facts.length === 0 ? <p className="bd-meta">{copy.empty}</p> : (
          <dl className="bd-facts">
            {account.facts.map((fact) => (
              <div key={fact.id} className="bd-item">
                <dt>{labels[fact.id]}</dt>
                <dd className={fact.id === "email" ? undefined : "num"}>{factText(fact, copy, locale)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <div className="bd-grid">
        <section className="bd-card" aria-labelledby="level-title">
          <BoxHead id="level-title" title={copy.levelTitle} />
          {account.bands && account.overall != null ? (
            <>
              <p className="bd-meta"><span className="num">{formatBand(account.overall, locale)}</span></p>
              {account.target != null ? (
                <div className="bd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={account.target} aria-valuenow={account.overall} aria-label={copy.levelTitle}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </>
          ) : <p className="bd-meta">{copy.empty}</p>}
          {account.bands ? null : (
            <div className="bd-actions">
              <Link className="bd-btn bd-btn-solid" href={hasGoal ? "/app/placement" : "/app/profile"}>{hasGoal ? copy.placement : copy.goal}</Link>
            </div>
          )}
        </section>

        <section className="bd-card" aria-labelledby="stats-title">
          <BoxHead id="stats-title" title={copy.statsTitle} />
          {stats.length === 0 ? <p className="bd-meta">{copy.empty}</p> : (
            <dl className="bd-facts">
              {stats.map((row) => (
                <div key={row.id} className="bd-item">
                  <dt>{row.label}</dt>
                  <dd className="num">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section className="bd-card" aria-labelledby="skills-title">
        <BoxHead id="skills-title" title={copy.progressTitle} />
        {account.bands ? (
          <dl className="bd-facts">
            {SKILL_FIELDS.map((skill) => (
              <div key={skill.id} className="bd-item">
                <dt>{locale === "fa" ? skill.fa : skill.en}</dt>
                <dd className="num">{formatBand(account.bands ? account.bands[skill.id] : 0, locale)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="bd-meta">{copy.empty}</p>}
      </section>
    </div>
  );
}
