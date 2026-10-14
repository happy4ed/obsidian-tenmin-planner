// 홈 (통계). 원본은 2000 × 1277 한 장이지만, 폰에서도 읽히게 카드를 폭에 맞춰 흘려 놓는다 (숫자 규칙은 원본 HomeStats 그대로).
import { useCtx } from "./ctx";
import { conceptOf, hex, Ink } from "./theme";
import * as Dates from "../model/dates";
import { completion, dailyAverage, HomeStats, makeHomeStats, marked } from "../model/homeStats";
import { ddayCount } from "../model/planner";

const hm = (min: number) => { const [h, m] = Dates.formatHM(min); return `${h}H${m}M`; };
/** 0 = 06시 줄 → "오전 9시 – 10시" (오전 · 오후가 같으면 뒤는 생략) */
function hourRange(row: number): string {
  const h = (6 + row) % 24, h2 = (h + 1) % 24;
  const ampm = (x: number) => (x < 12 ? "오전" : "오후");
  const n = (x: number) => `${x % 12 === 0 ? 12 : x % 12}시`;
  return `${ampm(h)} ${n(h)} – ${ampm(h2) === ampm(h) ? "" : `${ampm(h2)} `}${n(h2)}`;
}

export function HomePage({ openWeek, openDay }: { openWeek: (d: Date) => void; openDay: (d: Date) => void }) {
  const c = useCtx();
  const p = c.planner;
  const today = new Date();
  const s = makeHomeStats(p.data, today);
  const accent = conceptOf(p.data.prefs.defaultTheme).accent;
  return (
    <div class="tmp-home">
      <Overview openWeek={openWeek} />
      <DDayCard accent={accent} />
      <Summary s={s} accent={accent} />
      <Weeks s={s} openWeek={openWeek} />
      <Highlighters s={s} />
      <TimeOfDay s={s} />
      <Calendar s={s} openDay={openDay} />
      <Weekdays s={s} accent={accent} />
      <Marks s={s} accent={accent} />
    </div>
  );
}

function Card({ title, children, wide, onClick, hint }: { title: string; children: preact.ComponentChildren; wide?: boolean; onClick?: () => void; hint?: string }) {
  return (
    <section class={`tmp-card ${wide ? "is-wide" : ""} ${onClick ? "is-click" : ""}`} onClick={onClick} title={hint}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <div class="tmp-card-empty">{text}</div>;

function Overview({ openWeek }: { openWeek: (d: Date) => void }) {
  const p = useCtx().planner;
  const goal = p.week(Dates.weekStart(new Date())).goal;
  const b = p.book;
  return (
    <Card title="OVERVIEW" wide onClick={() => openWeek(new Date())} hint="이번 주 주간 페이지 열기">
      <div class="tmp-ov-book">{b?.name ?? "플래너"} <small>{b ? `${Dates.key(b.start)} – ${b.end ? Dates.key(b.end) : "계속"}` : ""}</small></div>
      <div class="tmp-ov-goal" style={{ color: goal ? Ink.text : Ink.faint }}>{goal || "이번 주 목표"}</div>
    </Card>
  );
}

function DDayCard({ accent }: { accent: string }) {
  const c = useCtx();
  const today = Dates.day(new Date());
  const list = c.planner.day(today).ddays;
  return (
    <Card title="D-DAY" onClick={() => c.openDDay(today)} hint="오늘의 D-day 고치기">
      {list.length === 0 ? <Empty text="+ D-day" /> : list.map((d) => (
        <div key={d.id} class="tmp-dd-row"><span>{d.title || "D-day"}</span><b style={{ color: accent }}>{ddayCount(d, today)}</b></div>
      ))}
    </Card>
  );
}

function Summary({ s, accent }: { s: HomeStats; accent: string }) {
  const last = s.weeks[s.weeks.length - 2]?.minutes ?? 0;
  const rate = completion(s);
  const items: [string, string, string?][] = [
    ["THIS WEEK", hm(s.weekMinutes), `지난주 ${hm(last)}`],
    ["THIS MONTH", hm(s.monthMinutes), `${s.month}월`],
    ["DAILY AVERAGE", hm(dailyAverage(s)), "기록한 날 평균"],
    ["RECORDED DAYS", `${s.monthDays} / ${s.daysInMonth}`, "이번 달"],
    ["STREAK", `${s.streak}일`, s.streakIncludesToday || s.todayOff ? "오늘까지" : "어제까지"],
    ["DONE RATE", rate == null ? "—" : `${Math.round(rate * 100)}%`, `표시한 할 일 ${marked(s)}개`],
  ];
  return (
    <Card title="SUMMARY" wide>
      <div class="tmp-sum-grid">
        {items.map(([k, v, cap]) => (
          <div key={k} class="tmp-sum"><small>{k}</small><b style={{ color: accent }}>{v}</b>{cap && <span>{cap}</span>}</div>
        ))}
      </div>
    </Card>
  );
}

function niceTicks(maxMin: number): number[] {
  const hours = maxMin / 60;
  for (const step of [1, 2, 5, 10, 15, 20, 25, 50, 100]) {
    if (Math.ceil(hours / step) <= 4) return Array.from({ length: Math.max(1, Math.ceil(hours / step)) }, (_, i) => (i + 1) * step);
  }
  return [Math.ceil(hours)];
}

function Weeks({ s, openWeek }: { s: HomeStats; openWeek: (d: Date) => void }) {
  const p = useCtx().planner;
  const max = Math.max(60, ...s.weeks.map((w) => w.minutes));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] * 60;
  return (
    <Card title="LAST 12 WEEKS" wide>
      {!s.hasTime ? <Empty text="타임테이블을 칠하면 여기에 통계가 쌓여요" /> : (
        <div class="tmp-weeks">
          <div class="tmp-weeks-axis">{[...ticks].reverse().map((t) => <span key={t}>{t}h</span>)}<span>0</span></div>
          {s.weeks.map((w) => (
            <button key={w.offset} class="tmp-week-bar" title={`${Dates.key(w.start)} 주 · ${hm(w.minutes)}`} onClick={() => openWeek(w.start)}>
              <div class="stack">
                {w.byCategory.map((m, i) => m > 0 && (
                  <div key={i} style={{ height: `${(m / top) * 100}%`, background: hex(p.categories[i]?.hex ?? "CFCFD4") }} />
                ))}
              </div>
              <small>{w.offset === 0 ? "이번 주" : `${w.start.getMonth() + 1}/${w.start.getDate()}`}</small>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Highlighters({ s }: { s: HomeStats }) {
  const p = useCtx().planner;
  const max = Math.max(1, ...s.categories.map((c) => c.minutes));
  const any = s.categories.some((c) => c.minutes > 0);
  return (
    <Card title={`HIGHLIGHTERS · ${s.month}월`}>
      {!any ? <Empty text="이번 달에 칠한 형광펜이 없어요" /> : (
        <>
          {s.categories.map((c) => {
            const cat = p.category(c.id);
            if (!cat) return null;
            return (
              <div key={c.id} class={`tmp-hl-row ${c.counts ? "" : "is-faint"}`}>
                <span class="name">{cat.name}{c.counts ? "" : " *"}</span>
                <span class="bar"><i style={{ width: `${(c.minutes / max) * 100}%`, background: hex(cat.hex) }} /></span>
                <span class="v">{hm(c.minutes)}</span>
              </div>
            );
          })}
          {s.categories.some((c) => !c.counts && c.minutes > 0) && <small class="tmp-note-small">* 흐린 형광펜은 TOTAL TIME 에 넣지 않아요</small>}
        </>
      )}
    </Card>
  );
}

function TimeOfDay({ s }: { s: HomeStats }) {
  const p = useCtx().planner;
  return (
    <Card title="TIME OF DAY · 지난 4주">
      {s.peakHour == null ? <Empty text="칠한 시간이 쌓이면 자주 쓰는 시간대가 보여요" /> : (
        <>
          <div class="tmp-heat">
            {Array.from({ length: 24 }, (_, r) => (
              <div key={r} class="row">
                <small>{(6 + r) % 24}</small>
                {s.heat.slice(r * 6, r * 6 + 6).map((h, k) => {
                  const cat = h.category != null ? p.category(h.category) : undefined;
                  const level = Math.ceil(h.ratio * 10) / 10;
                  return <i key={k} style={{ background: cat ? hex(cat.hex) : "transparent", opacity: cat ? Math.max(0.1, level) : 1 }} />;
                })}
              </div>
            ))}
          </div>
          <small class="tmp-note-small">가장 자주 칠한 시간  {hourRange(s.peakHour)}</small>
        </>
      )}
    </Card>
  );
}

function Calendar({ s, openDay }: { s: HomeStats; openDay: (d: Date) => void }) {
  const p = useCtx().planner;
  const level = (c: HomeStats["calendar"][number]) =>
    c.minutes >= 360 ? 4 : c.minutes >= 240 ? 3 : c.minutes >= 120 ? 2 : c.minutes > 0 || c.recorded ? 1 : 0;
  return (
    <Card title="LAST 35 DAYS">
      <div class="tmp-cal">
        {["", "월", "화", "수", "목", "금", "토", "일"].map((d, i) => <small key={`h${i}`} class="head">{d}</small>)}
        {Array.from({ length: 5 }, (_, w) => [
          <small key={`m${w}`} class="mon">{s.calendar[w * 7].date.getMonth() + 1}/{s.calendar[w * 7].date.getDate()}</small>,
          ...s.calendar.slice(w * 7, w * 7 + 7).map((c) => {
            const lv = level(c);
            const tint = conceptOf(c.theme ?? p.data.prefs.defaultTheme).accent;
            return (
              <button key={Dates.key(c.date)} disabled={c.isFuture} title={`${Dates.key(c.date)} · ${hm(c.minutes)}${c.dayOff ? " · DAY OFF" : ""}`}
                class={`day ${c.isToday ? "is-today" : ""}`} onClick={() => openDay(c.date)}
                style={{ background: lv ? tint : "transparent", opacity: lv ? 0.2 + lv * 0.2 : 1 }}>
                {c.dayOff && <i class="off" />}
              </button>
            );
          }),
        ])}
      </div>
    </Card>
  );
}

function Weekdays({ s, accent }: { s: HomeStats; accent: string }) {
  const max = Math.max(...s.weekdayAverage);
  return (
    <Card title="WEEKDAYS · 지난 8주">
      {max === 0 ? <Empty text="요일별 평균은 기록이 쌓이면 보여요" /> : (
        <div class="tmp-wd">
          {s.weekdayAverage.map((m, i) => (
            <div key={i} class={`col ${m === max ? "is-max" : ""}`}>
              <span class="v">{m >= 60 ? `${Math.floor(m / 60)}h` : `${m}m`}</span>
              <span class="bar"><i style={{ height: `${(m / max) * 100}%`, background: m === max ? accent : "#C9C6BF" }} /></span>
              <small>{"월화수목금토일"[i]}</small>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Marks({ s, accent }: { s: HomeStats; accent: string }) {
  const total = marked(s);
  const items: [string, string, number, number][] = [
    ["완료", "○", s.done, 1], ["일부", "△", s.partial, 0.6], ["못함", "×", s.missed, 0.35], ["미룸", "→", s.moved, 0.2],
  ];
  return (
    <Card title={`TASK MARKS · ${s.month}월`}>
      {total === 0 ? <Empty text="할 일에 ○ △ × → 를 표시하면 여기에 모여요" /> : (
        <>
          <div class="tmp-marks">
            {items.map(([name, sym, n]) => <div key={name}><b style={{ color: accent }}>{sym} {n}</b><small>{name}</small></div>)}
          </div>
          <div class="tmp-mark-strip">
            {items.map(([name, , n, o]) => n > 0 && <i key={name} style={{ flex: n, background: accent, opacity: o }} />)}
          </div>
        </>
      )}
    </Card>
  );
}
