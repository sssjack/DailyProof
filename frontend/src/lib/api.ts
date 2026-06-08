export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user" | string;
  created_at: string;
};

export type Task = {
  id: number;
  title: string;
  task_type: "item" | "practice";
  category: string;
  practice_tag: string | null;
  planned_start: string | null;
  planned_end: string | null;
  target_minutes: number | null;
  target_count: number | null;
  status: "pending" | "running" | "done" | "skipped";
  accumulated_seconds: number;
  timer_started_at: string | null;
  completed_at: string | null;
  result_question_count: number | null;
  result_accuracy: number | null;
  result_minutes: number | null;
  note: string;
};

export type DailyPlan = {
  id: number;
  date: string;
  note: string;
  completion_rate: number;
  tasks_done: number;
  tasks_total: number;
  tasks: Task[];
};

export type MonthlyPlan = {
  id: number;
  year: number;
  month: number;
  title: string;
  objective: string;
  target_minutes: number;
  target_accuracy: number;
  category_goals: Record<string, CategoryGoal> | null;
  routine_text: string;
  status: string;
  blocks: Array<{
    id: number;
    title: string;
    task_type: "item" | "practice";
    category: string;
    practice_tag: string | null;
    start_time: string | null;
    end_time: string | null;
    target_minutes: number | null;
    target_count: number | null;
  }>;
};

export type MonthlyStats = {
  year: number;
  month: number;
  tasks_total: number;
  tasks_done: number;
  completion_rate: number;
  study_hours: number;
  result_count: number;
  practice_task_count: number;
  question_total: number;
  practice_minutes: number;
  avg_accuracy: number;
  avg_result_minutes: number;
  avg_practice_minutes: number;
  tag_summary: PracticeTagSummary[];
  practice_trends?: Record<string, PracticeTrendPoint[]>;
  weekly: Array<{
    week: string;
    start: string;
    end: string;
    question_count: number;
    practice_minutes: number;
    accuracy: number | null;
    practice_task_count: number;
  }>;
  total: {
    practice_task_count: number;
    question_total: number;
    practice_minutes: number;
    avg_accuracy: number;
    tag_summary: PracticeTagSummary[];
  };
  daily: Array<{
    date: string;
    completion_rate: number;
    tasks_done: number;
    tasks_total: number;
    result_count: number;
    practice_task_count: number;
    question_count: number;
    accuracy: number | null;
    result_minutes: number | null;
    practice_minutes: number | null;
    tag_summary: PracticeTagSummary[];
  }>;
};

export type PracticeTrendPoint = {
  id: number;
  date: string;
  title: string;
  tag: string;
  label: string;
  sequence: number;
  question_count: number;
  accuracy: number | null;
  minutes: number;
  target_minutes: number | null;
  completed_at: string | null;
  planned_start: string | null;
};

export type PracticeTagSummary = {
  tag: string;
  label: string;
  task_count: number;
  question_count: number;
  accuracy: number | null;
  minutes: number;
};

export type AdminResult = {
  id: number;
  user: string;
  name: string;
  date: string;
  title: string;
  task_type: "item" | "practice";
  category: string;
  practice_tag: string;
  practice_label: string;
  question_count: number | null;
  accuracy: number | null;
  duration_seconds: number;
  result_minutes: number;
  completed_at: string | null;
};

export type PracticeRecord = {
  id: number;
  date: string;
  category: string;
  label: string;
  question_count: number;
  correct_count: number;
  minutes: number;
  accuracy: number;
  issue_tags: string[];
  issue_labels: string[];
  note: string;
  created_at: string | null;
  updated_at: string | null;
};

export type PracticeRecordPeriodSummary = {
  record_count: number;
  question_count: number;
  correct_count: number;
  minutes: number;
  accuracy: number | null;
};

export type PracticeRecordTrendPoint = PracticeRecordPeriodSummary & {
  period: string;
  label: string;
  start: string;
  end: string;
};

export type PracticeRecordCategorySummary = PracticeRecordPeriodSummary & {
  category: string;
  label: string;
  issue_summary: Array<{ tag: string; label: string; count: number }>;
  trend: PracticeRecordTrendPoint[];
};

export type PracticeRecordStats = {
  scope: "week" | "month" | "range";
  year: number;
  month: number | null;
  start: string;
  end: string;
  categories: Array<{ category: string; label: string }>;
  summary: PracticeRecordPeriodSummary;
  issue_summary: Array<{ tag: string; label: string; count: number }>;
  category_summary: PracticeRecordCategorySummary[];
  periods: Array<PracticeRecordTrendPoint & { issue_summary: Array<{ tag: string; label: string; count: number }>; categories: Record<string, PracticeRecordPeriodSummary> }>;
  records: PracticeRecord[];
};

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/DailyProof/api").replace(/\/$/, "");
const TOKEN_KEY = "dailyproof_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (response.status === 401) setToken(null);
    throw new Error(data?.detail || "请求失败");
  }
  return data as T;
}

export async function login(email: string, password: string) {
  const data = await api<{ access_token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(data.access_token);
  return data.user;
}

export async function register(email: string, password: string, name: string) {
  const data = await api<{ access_token: string; user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name })
  });
  setToken(data.access_token);
  return data.user;
}

export const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const categoryLabel = (category: string) => {
  const map: Record<string, string> = {
    data_analysis: "资料分析",
    quantitative: "数量关系",
    verbal: "言语理解",
    graphic_reasoning: "图推",
    judgement_reasoning: "判断推理",
    political_theory: "政治理论",
    common_sense: "常识",
    fitness: "健身",
    review: "复盘",
    study: "学习",
    life: "生活"
  };
  return map[category] || category;
};

export type CategoryGoal = {
  target_accuracy: number;
  target_minutes: number;
};

export type AIResponse = {
  available: boolean;
  content?: string | null;
  message?: string;
};

export type DistributionStats = {
  start: string;
  end: string;
  accuracy_distribution: Array<{ range: string; count: number }>;
  time_per_question_trend: Array<{
    period: string;
    label: string;
    minutes_per_question: number | null;
    total_minutes: number;
    total_questions: number;
  }>;
  yoy_comparison: {
    current: PracticeRecordPeriodSummary;
    previous: PracticeRecordPeriodSummary;
    previous_year: number;
    current_year: number;
  } | null;
};
