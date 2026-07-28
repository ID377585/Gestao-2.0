export type TimeClockEventType =
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out";

export type TimeClockState =
  | "not_started"
  | "working"
  | "on_break"
  | "finished"
  | "blocked";

export type TimeClockSettings = {
  enabled: boolean;
  dailyMinutes: number;
  breakMinutes: number;
  toleranceMinutes: number;
  timezone: string;
  allowOvernight: boolean;
  maxShiftHours: number;
};

export type TimeClockEventView = {
  id: string;
  eventType: TimeClockEventType;
  occurredAt: string;
};

export type TimeClockShiftSummary = {
  shiftId: string;
  workDate: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  events: TimeClockEventView[];
  workedSeconds: number;
  breakSeconds: number;
  targetSeconds: number;
  adjustmentSeconds: number;
  balanceSeconds: number;
  liveWorkStartedAt: string | null;
  liveBreakStartedAt: string | null;
};

export type TimeClockDashboardData = {
  serverNow: string;
  timezone: string;
  user: {
    id: string;
    name: string;
  };
  state: TimeClockState;
  nextEventType: TimeClockEventType;
  nextActionLabel: string;
  settings: TimeClockSettings;
  canManageSettings: boolean;
  currentShift: TimeClockShiftSummary | null;
  monthBalanceSeconds: number;
  closedMonthBalanceSeconds: number;
  history: TimeClockShiftSummary[];
};

export type TimeClockActionResult =
  | {
      ok: true;
      data: TimeClockDashboardData;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type TimeClockSettingsInput = {
  enabled: boolean;
  dailyMinutes: number;
  breakMinutes: number;
  toleranceMinutes: number;
  timezone: string;
  allowOvernight: boolean;
  maxShiftHours: number;
};
