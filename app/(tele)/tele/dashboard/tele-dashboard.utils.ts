import type {
  TeleDashboardAttentionItem,
  TeleDashboardData,
  TeleDashboardHealth,
  TeleShiftInfo,
} from "./tele-dashboard.types";

export function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function pct(n?: number | null) {
  return `${Number(n ?? 0).toFixed(1)}%`;
}

export function safePct(num: number, den: number) {
  if (!den) return 0;
  return Number(((num / den) * 100).toFixed(1));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function localDateParts(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { yyyy, mm, dd };
}

function buildLocalDateAt(hour: number, minute: number, second = 0, ms = 0) {
  const now = new Date();
  const { yyyy, mm, dd } = localDateParts(now);
  return new Date(`${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.${String(ms).padStart(3, "0")}`);
}

export function getShiftInfo(now = new Date()): TeleShiftInfo {
  const shift1Start = buildLocalDateAt(9, 0, 0, 0);
  const shift1End = buildLocalDateAt(12, 30, 0, 0);

  const shift2Start = buildLocalDateAt(13, 0, 0, 0);
  const shift2End = buildLocalDateAt(18, 0, 0, 0);

  const nowMs = now.getTime();

  if (nowMs >= shift1Start.getTime() && nowMs <= shift1End.getTime()) {
    return {
      current_shift: "SHIFT_1",
      current_shift_label: "Shift 1 (09:00–12:30)",
      shift_start_iso: shift1Start.toISOString(),
      shift_end_iso: shift1End.toISOString(),
      shift_active: true,
    };
  }

  if (nowMs >= shift2Start.getTime() && nowMs <= shift2End.getTime()) {
    return {
      current_shift: "SHIFT_2",
      current_shift_label: "Shift 2 (13:00–18:00)",
      shift_start_iso: shift2Start.toISOString(),
      shift_end_iso: shift2End.toISOString(),
      shift_active: true,
    };
  }

  return {
    current_shift: "OUTSIDE_SHIFT",
    current_shift_label: "Outside shift",
    shift_start_iso: null,
    shift_end_iso: null,
    shift_active: false,
  };
}

export function buildTeleAttention(input: {
  shift: TeleShiftInfo;
  terminal_today: number;
  current_shift_processed: number;
  active_holding: number;
  stale_holding: number;
  overdue_callbacks: number;
  callback_holding: number;
  current_shift_target: number;
  day_target: number;
}): TeleDashboardAttentionItem[] {
  const items: TeleDashboardAttentionItem[] = [];

  if (input.overdue_callbacks > 0) {
    items.push({
      title: "Overdue callbacks need attention",
      detail: `You have ${input.overdue_callbacks} overdue callback(s) in this campaign.`,
      tone: "danger",
    });
  }

  if (input.stale_holding > 0) {
    items.push({
      title: "Some contacts are stale",
      detail: `${input.stale_holding} assigned contact(s) are stale or past lease timing.`,
      tone: "warn",
    });
  }

  if (input.active_holding === 0) {
    items.push({
      title: "No active contacts in hand",
      detail: "Your queue is empty. Pull more contacts from this campaign or another active campaign.",
      tone: "default",
    });
  }

  if (input.shift.shift_active && input.current_shift_processed === 0 && input.active_holding > 0) {
    items.push({
      title: "No completed contacts in current shift yet",
      detail: `You are in ${input.shift.current_shift_label} but have not completed any terminal contact in this shift yet.`,
      tone: "warn",
    });
  }

  if (
    input.shift.shift_active &&
    input.current_shift_processed > 0 &&
    input.current_shift_processed < input.current_shift_target
  ) {
    items.push({
      title: "Current shift target still in progress",
      detail: `${input.current_shift_processed}/${input.current_shift_target} contacts completed in ${input.shift.current_shift_label}.`,
      tone: "default",
    });
  }

  if (
    input.shift.shift_active &&
    input.current_shift_processed >= input.current_shift_target
  ) {
    items.push({
      title: "Current shift target achieved",
      detail: `You have reached the 100-contact KPI for ${input.shift.current_shift_label}.`,
      tone: "good",
    });
  }

  if (input.terminal_today >= input.day_target) {
    items.push({
      title: "Daily target achieved",
      detail: `You have reached or exceeded the 200-contact daily KPI.`,
      tone: "good",
    });
  }

  if (input.callback_holding > 0 && input.overdue_callbacks === 0) {
    items.push({
      title: "Callbacks waiting in queue",
      detail: `${input.callback_holding} callback contact(s) are currently in your queue.`,
      tone: "default",
    });
  }

  return items.slice(0, 5);
}

export function buildTeleHealth(input: {
  current_shift_processed: number;
  terminal_today: number;
  active_holding: number;
  stale_holding: number;
  overdue_callbacks: number;
  shift_active: boolean;
  current_shift_target: number;
  day_target: number;
}): TeleDashboardHealth {
  let productivity_state: TeleDashboardHealth["productivity_state"] = "low";
  let productivity_label = "Low progress";

  if (input.terminal_today >= input.day_target) {
    productivity_state = "excellent";
    productivity_label = "Daily target achieved";
  } else if (input.shift_active && input.current_shift_processed >= input.current_shift_target) {
    productivity_state = "good";
    productivity_label = "Current shift target achieved";
  } else if (input.shift_active && input.current_shift_processed === 0) {
    productivity_state = "idle";
    productivity_label = "No completed contacts in current shift yet";
  }

  let queue_state: TeleDashboardHealth["queue_state"] = "healthy";
  let queue_label = "Queue healthy";

  if (input.overdue_callbacks > 0 || input.stale_holding >= 3) {
    queue_state = "risk";
    queue_label = "Queue at risk";
  } else if (input.stale_holding > 0 || input.active_holding >= 20) {
    queue_state = "watch";
    queue_label = "Watch queue";
  }

  return {
    productivity_state,
    productivity_label,
    queue_state,
    queue_label,
  };
}

export function healthToneClass(data: TeleDashboardData["health"]) {
  if (data.productivity_state === "excellent") {
    return "border-emerald-500/30 bg-emerald-500/5";
  }
  if (data.productivity_state === "good") {
    return "border-sky-500/30 bg-sky-500/5";
  }
  if (data.productivity_state === "idle") {
    return "border-amber-500/30 bg-amber-500/5";
  }
  return "border-border";
}