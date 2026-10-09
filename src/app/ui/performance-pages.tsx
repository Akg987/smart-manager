import Link from "next/link";
import { serverApi } from "@/lib/api-server";
import type { RoutePage } from "./route-catalog";
import {
  ActionMoves,
  AlertDecisions,
  CheckinSubmit,
  KpiCreateButton,
  KpiStudioTable,
  type StudioRow,
} from "./performance-client";

type CheckinCard = {
  kpiId: string;
  name: string;
  department: string;
  inputMode: string;
  inputOptions: string[];
  formulaType: string;
  unit: string;
  period: string;
  target: string;
  actual: string | null;
  health: string;
  frequency: string;
  direction: string;
  status: string;
  note: string;
};
type CheckinBoard = {
  period: string;
  canSubmit: boolean;
  assigned: number;
  open: CheckinCard[];
  late: CheckinCard[];
  history: CheckinCard[];
};
type AlertRow = {
  id: string;
  title: string;
  description: string;
  severity: string;
  band: "critical" | "red" | "yellow" | "other";
  status: string;
  period: string | null;
  kpiName: string | null;
  department: string | null;
  assignee: string | null;
};
type AlertBoard = {
  canAcknowledge: boolean;
  canResolve: boolean;
  rows: AlertRow[];
};
type ActionCard = {
  id: string;
  title: string;
  description: string;
  successMetric: string;
  priority: string;
  owner: string;
  dueAt: string | null;
  status: string;
  overdue: boolean;
  canUpdate: boolean;
  canApprove: boolean;
  progress: number;
};
type ActionBoard = {
  proposed: ActionCard[];
  approved: ActionCard[];
  in_progress: ActionCard[];
  blocked: ActionCard[];
  pending_completion_approval: ActionCard[];
  closed: ActionCard[];
  legacy_done: ActionCard[];
  canceled: ActionCard[];
};

function faNum(value: unknown) {
  return String(value ?? 0).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

function plainNumber(value: string | null) {
  if (value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : value;
}

const directionLabel: Record<string, string> = {
  higher: "بیشتر بهتر",
  lower: "کمتر بهتر",
  range: "در بازه",
};
const checkinStatus: Record<string, string> = {
  due: "منتظر ثبت",
  draft: "پیش‌نویس",
  late: "عقب‌افتاده",
  submitted: "ثبت‌شده",
  revised: "اصلاح‌شده",
};
const bandLabel: Record<string, string> = {
  critical: "بحرانی",
  red: "قرمز",
  yellow: "زرد",
  other: "کم",
};
const alertStatus: Record<string, string> = {
  open: "باز",
  acknowledged: "دیده‌شده",
  resolved: "بسته‌شده",
};

function Heading({
  page,
  action,
}: {
  page: RoutePage;
  action?: React.ReactNode;
}) {
  return (
    <header className="sm-page-head">
      <div className="sm-page-head__copy">
        <span className="sm-page-head__eyebrow">{page.eyebrow}</span>
        <h1>{page.headline ?? page.title}</h1>
        <p>{page.description}</p>
      </div>
      {action && <div className="sm-page-head__action">{action}</div>}
    </header>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="sm-board-empty" role="status">
      <h2 className="title">{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function CheckinCards({
  cards,
  canSubmit,
  revise,
}: {
  cards: CheckinCard[];
  canSubmit: boolean;
  revise?: boolean;
}) {
  if (!cards.length)
    return (
      <EmptyState
        title="موردی در این فهرست ندارید."
        text="فیلتر را تغییر دهید یا کمی بعد دوباره بررسی کنید."
      />
    );
  return (
    <div className="sm-checkin-grid">
      {cards.map((card) => {
        const target = `${faNum(plainNumber(card.target))} ${card.unit}`;
        const periodLabel = faNum(card.period);
        return (
          <article
            className={`sm-checkin-card ${card.status === "late" ? "is-late" : ""}`}
            key={`${card.kpiId}-${card.period}-${card.status}`}
          >
            <div className="sm-checkin-card-top">
              <span className="sm-checkin-glyph" aria-hidden="true">
                <em className="icon ni ni-growth" />
              </span>
              <span
                className={`sm-checkin-status ${card.status === "draft" ? "is-draft" : ""}`}
              >
                {checkinStatus[card.status] ?? card.status}
              </span>
            </div>
            <div className="sm-checkin-card-body">
              <span className="sm-checkin-unit">{card.department}</span>
              <h2 className="sm-checkin-title">{card.name}</h2>
              <p className="sm-checkin-lead">
                {revise
                  ? `ثبت دوره ${periodLabel}`
                  : `دوره ${periodLabel} هنوز باز است.`}
              </p>
            </div>
            <div className="sm-checkin-data">
              <span>
                <small>دوره</small>
                <strong>{periodLabel}</strong>
              </span>
              <span>
                <small>هدف</small>
                <strong>{target}</strong>
              </span>
              <span>
                <small>آخرین مقدار</small>
                <strong>
                  {card.actual === null ? "—" : faNum(plainNumber(card.actual))}
                </strong>
              </span>
            </div>
            <div className="sm-checkin-chips">
              <span>{card.frequency}</span>
              <span>{directionLabel[card.direction] ?? card.direction}</span>
            </div>
            {canSubmit && (
              <CheckinSubmit
                kpiId={card.kpiId}
                period={card.period}
                periodLabel={periodLabel}
                department={card.department}
                targetLabel={target}
                inputMode={card.inputMode}
                inputOptions={card.inputOptions}
                formulaType={card.formulaType}
                revise={revise}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

async function CheckinsPage({
  page,
  view,
}: {
  page: RoutePage;
  view?: string;
}) {
  const result = await serverApi<CheckinBoard>("checkins/board");
  const board = result.data;
  const tab = view === "late" || view === "history" ? view : "open";
  const completed = Boolean(
    board && board.assigned > 0 && board.open.length === 0,
  );
  const tabs = [
    { id: "open", label: "امروز و باز" },
    { id: "late", label: "عقب‌افتاده" },
    { id: "history", label: "تاریخچه" },
  ];
  return (
    <div className="sm-checkin-page">
      <Heading
        page={page}
        action={
          completed ? (
            <div className="sm-checkin-score">
              <strong>
                <em className="icon ni ni-check-circle" />
              </strong>
              <span>ثبت تکمیل‌شده</span>
            </div>
          ) : undefined
        }
      />
      <div className="sm-checkin-toolbar">
        <ul className="sm-checkin-tabs">
          {tabs.map((item) => (
            <li key={item.id}>
              <Link
                className={tab === item.id ? "active" : ""}
                href={
                  item.id === "open" ? "/checkins" : `/checkins?view=${item.id}`
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {result.error && (
        <div role="alert" className="alert alert-fill alert-warning mb-3">
          {result.error}
        </div>
      )}
      {tab === "open" && (
        <CheckinCards
          cards={board?.open ?? []}
          canSubmit={board?.canSubmit === true}
        />
      )}
      {tab === "late" && (
        <CheckinCards
          cards={board?.late ?? []}
          canSubmit={board?.canSubmit === true}
        />
      )}
      {tab === "history" && (
        <CheckinCards
          cards={board?.history ?? []}
          canSubmit={board?.canSubmit === true}
          revise
        />
      )}
    </div>
  );
}

async function AlertsPage({ page, view }: { page: RoutePage; view?: string }) {
  const result = await serverApi<AlertBoard>("alerts/board");
  const board = result.data;
  const tab =
    view === "critical" || view === "red" || view === "yellow" ? view : "all";
  const tabs = [
    { id: "all", label: "همه" },
    { id: "critical", label: "بحرانی" },
    { id: "red", label: "قرمز" },
    { id: "yellow", label: "زرد" },
  ];
  const rows = (board?.rows ?? []).filter(
    (row) => tab === "all" || row.band === tab,
  );
  return (
    <div className="sm-checkin-page">
      <Heading page={page} />
      <div className="sm-checkin-toolbar">
        <ul className="sm-checkin-tabs">
          {tabs.map((item) => (
            <li key={item.id}>
              <Link
                className={tab === item.id ? "active" : ""}
                href={item.id === "all" ? "/alerts" : `/alerts?view=${item.id}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {result.error && (
        <div role="alert" className="alert alert-fill alert-warning mb-3">
          {result.error}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title="هشداری با این فیلتر ندارید."
          text="برای دیدن هشدارهای دیگر فیلتر را تغییر دهید."
        />
      ) : (
        <div className="sm-alerts-list">
          {rows.map((row) => (
            <article className="sm-alert-card" key={row.id}>
              <span
                className={`sm-alert-rail ${row.band === "yellow" ? "is-warning" : row.band === "other" ? "is-info" : "is-danger"}`}
              />
              <div className="sm-alert-main">
                <div className="sm-alert-topline">
                  <h2 className="sm-alert-title">{row.title}</h2>
                  <span
                    className={`sm-kpi-pill is-${row.band === "critical" || row.band === "red" ? "red" : row.band === "yellow" ? "yellow" : "unknown"}`}
                  >
                    {alertStatus[row.status] ?? row.status}
                  </span>
                </div>
                {row.description && (
                  <p className="text-soft mt-2 mb-0">{row.description}</p>
                )}
                <div className="sm-alert-tags mt-2">
                  <span className="sm-meta-chip">
                    {bandLabel[row.band] ?? row.band}
                  </span>
                  {row.kpiName && (
                    <span className="sm-meta-chip">{row.kpiName}</span>
                  )}
                </div>
                <div className="sm-alert-facts">
                  <span>
                    <small>دوره</small>
                    {row.period ? faNum(row.period) : "—"}
                  </span>
                  <span>
                    <small>واحد</small>
                    {row.department ?? "—"}
                  </span>
                  <span>
                    <small>مسئول</small>
                    {row.assignee ?? "تعیین نشده"}
                  </span>
                </div>
              </div>
              <AlertDecisions
                id={row.id}
                status={row.status}
                canAcknowledge={board?.canAcknowledge === true}
                canResolve={board?.canResolve === true}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionColumn({
  title,
  cards,
}: {
  title: string;
  cards: ActionCard[];
}) {
  return (
    <section className="sm-kanban-column">
      <div className="sm-kanban-heading">
        <h6>{title}</h6>
        <span>{faNum(cards.length)}</span>
      </div>
      <div className="sm-kanban-stack">
        {cards.length === 0 ? (
          <p className="sm-kanban-empty">موردی ندارد</p>
        ) : (
          cards.map((card) => {
            const due = card.dueAt
              ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                  timeZone: "Asia/Tehran",
                  day: "numeric",
                  month: "long",
                }).format(new Date(card.dueAt))
              : "بدون موعد";
            const initials = card.owner
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join("");
            return (
              <article className="sm-action-card" key={card.id}>
                <div className="sm-action-card-top">
                  <span className="sm-priority-pill">{card.priority}</span>
                  {card.overdue && (
                    <span className="badge badge-dim bg-danger">عقب‌افتاده</span>
                  )}
                </div>
                <h5>{card.title}</h5>
                <p>
                  {card.successMetric ||
                    card.description ||
                    "معیار موفقیت ثبت نشده است."}
                </p>
                <div className="sm-action-card-foot">
                  <div className="sm-action-owner">
                    <span className="user-avatar sm">
                      <span>{initials || "؟"}</span>
                    </span>
                    <small>
                      {card.owner}
                      <br />
                      {due}
                    </small>
                  </div>
                </div>
                {(card.canUpdate || card.canApprove) && (
                  <ActionMoves
                    id={card.id}
                    status={card.status}
                    progress={card.progress}
                    canUpdate={card.canUpdate}
                    canApprove={card.canApprove}
                  />
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

async function ActionsPage({ page }: { page: RoutePage }) {
  const result = await serverApi<ActionBoard>("actions/board");
  const board = result.data ?? {
    proposed: [],
    approved: [],
    in_progress: [],
    blocked: [],
    pending_completion_approval: [],
    closed: [],
    legacy_done: [],
    canceled: [],
  };
  return (
    <>
      <Heading
        page={page}
        action={
          <Link href="/actions/create" className="btn btn-primary">
            <span>اقدام جدید</span>
            <em className="icon ni ni-plus" />
          </Link>
        }
      />
      {result.error && (
        <div role="alert" className="alert alert-fill alert-warning mb-3">
          {result.error}
        </div>
      )}
      <div className="sm-kanban">
        <ActionColumn title="پیشنهادی" cards={board.proposed} />
        <ActionColumn title="Approved" cards={board.approved} />
        <ActionColumn title="در حال انجام" cards={board.in_progress} />
        <ActionColumn title="مسدود" cards={board.blocked} />
        <ActionColumn
          title="Pending completion approval"
          cards={board.pending_completion_approval}
        />
        <ActionColumn title="انجام شده" cards={board.closed} />
        <ActionColumn
          title="Historical done (unverified)"
          cards={board.legacy_done}
        />
        <ActionColumn title="Canceled" cards={board.canceled} />
      </div>
    </>
  );
}

async function KpiPage({ page }: { page: RoutePage }) {
  const result = await serverApi<{ activeCount: number; rows: StudioRow[] }>(
    "kpis/studio",
  );
  return (
    <>
      <Heading page={page} action={<KpiCreateButton />} />
      {result.error && (
        <div role="alert" className="alert alert-fill alert-warning mb-3">
          {result.error}
        </div>
      )}
      <KpiStudioTable
        rows={result.data?.rows ?? []}
        activeCount={result.data?.activeCount ?? 0}
      />
    </>
  );
}

export async function PerformanceBoard({
  page,
  view,
}: {
  page: RoutePage;
  view?: string;
}) {
  if (page.board === "checkins") return CheckinsPage({ page, view });
  if (page.board === "alerts") return AlertsPage({ page, view });
  if (page.board === "actions") return ActionsPage({ page });
  return KpiPage({ page });
}
