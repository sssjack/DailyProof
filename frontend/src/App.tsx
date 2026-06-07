import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FilePenLine,
  Gauge,
  Home,
  LogOut,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Sparkles,
  Sun,
  Target,
  TimerReset,
  TrendingUp,
  Trash2,
  UserRound
} from "lucide-react";
import {
  API_BASE,
  DailyPlan,
  MonthlyPlan,
  MonthlyStats,
  PracticeRecord,
  PracticeRecordPeriodSummary,
  PracticeRecordStats,
  PracticeRecordTrendPoint,
  PracticeTrendPoint,
  Task,
  User,
  api,
  categoryLabel,
  formatDuration,
  getToken,
  login,
  register,
  setToken
} from "./lib/api";

type View = "home" | "dashboard" | "records" | "stats" | "calendar";
type ThemeName = "night" | "dawn" | "pulse";
type TaskPatchPayload = Partial<
  Pick<Task, "status" | "note" | "result_question_count" | "result_accuracy" | "result_minutes">
>;

const heroUrl = `${import.meta.env.BASE_URL}hero-dailyproof.png`;
const themes: Array<{ id: ThemeName; label: string; icon: ReactNode }> = [
  { id: "dawn", label: "晨光", icon: <Sun size={15} /> },
  { id: "pulse", label: "脉冲", icon: <Sparkles size={15} /> },
  { id: "night", label: "夜航", icon: <Moon size={15} /> }
];

const practiceTags = [
  "data_analysis",
  "quantitative",
  "verbal",
  "graphic_reasoning",
  "judgement_reasoning",
  "political_theory",
  "common_sense"
];

const recordCategories = [
  { category: "verbal", label: "言语" },
  { category: "graphic_reasoning", label: "图推" },
  { category: "quantitative", label: "数量关系" },
  { category: "data_analysis", label: "资料分析" },
  { category: "judgement_reasoning", label: "判断推理" },
  { category: "political_theory", label: "政治理论" },
  { category: "common_sense", label: "常识" }
];

const recordColors = ["#6366f1", "#06b6d4", "#ec4899", "#22c55e", "#f59e0b", "#8b5cf6", "#64748b"];
const issueTags = [
  { tag: "careless", label: "粗心" },
  { tag: "slow_calculation", label: "计算慢" },
  { tag: "misread", label: "审题错" },
  { tag: "formula", label: "公式不熟" },
  { tag: "time_control", label: "时间失控" },
  { tag: "knowledge_gap", label: "知识点不熟" },
  { tag: "state", label: "状态波动" }
];

const recordTemplates = [
  { name: "资料套题", category: "data_analysis", questionCount: 20, correctCount: 18, minutes: 27, issueTags: ["time_control"] },
  { name: "数量 10 题", category: "quantitative", questionCount: 10, correctCount: 8, minutes: 20, issueTags: ["slow_calculation"] },
  { name: "言语 20 题", category: "verbal", questionCount: 20, correctCount: 17, minutes: 25, issueTags: ["misread"] },
  { name: "图推 10 题", category: "graphic_reasoning", questionCount: 10, correctCount: 8, minutes: 12, issueTags: ["state"] }
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("home");
  const [theme, setTheme] = useState<ThemeName>(() => (localStorage.getItem("dailyproof_theme") as ThemeName) || "dawn");
  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    localStorage.setItem("dailyproof_theme", theme);
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBooting(false);
      return;
    }
    api<User>("/me")
      .then((nextUser) => {
        setUser(nextUser);
        setView("dashboard");
      })
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  const onAuthed = (nextUser: User) => {
    setUser(nextUser);
    setView("dashboard");
    setToast(`欢迎回来，${nextUser.name}`);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setView("home");
    setToast("已退出登录");
  };

  if (booting) {
    return <div className="boot">DailyProof 正在校准今日节奏...</div>;
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <TopBar user={user} view={view} setView={setView} logout={logout} theme={theme} setTheme={setTheme} />
      {view === "home" && (
        <Landing
          user={user}
          onAuthed={onAuthed}
          onEnterApp={() => setView("dashboard")}
          onOpenRecords={() => setView("records")}
          onOpenAnalytics={() => setView("stats")}
        />
      )}
      {user && view === "dashboard" && <Dashboard user={user} toast={setToast} />}
      {user && view === "records" && <PracticeRecordsPage toast={setToast} />}
      {user && view === "stats" && <StatsCenter />}
      {user && view === "calendar" && <CalendarPage />}
      {!user && view !== "home" && (
        <Landing
          user={null}
          onAuthed={onAuthed}
          onEnterApp={() => setView("dashboard")}
          onOpenRecords={() => setView("records")}
          onOpenAnalytics={() => setView("stats")}
        />
      )}
      {user && <MobileNav view={view} setView={setView} />}
      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
    </div>
  );
}

function MobileNav({ view, setView }: { view: View; setView: (view: View) => void }) {
  const items: Array<{ view: View; label: string; icon: ReactNode }> = [
    { view: "dashboard", label: "Today", icon: <ClipboardList size={18} /> },
    { view: "records", label: "Records", icon: <FilePenLine size={18} /> },
    { view: "stats", label: "Analytics", icon: <BarChart3 size={18} /> },
    { view: "calendar", label: "Calendar", icon: <CalendarDays size={18} /> }
  ];

  return (
    <nav className="mobile-tabbar" aria-label="移动端导航">
      {items.map((item) => (
        <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => setView(item.view)}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function TopBar({
  user,
  view,
  setView,
  logout,
  theme,
  setTheme
}: {
  user: User | null;
  view: View;
  setView: (view: View) => void;
  logout: () => void;
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}) {
  return (
    <header className={`topbar ${user ? "app-sidebar" : "public-topbar"}`}>
      <button className="brand" onClick={() => setView(user ? "dashboard" : "home")} title="DailyProof">
        <span className="brand-mark">D</span>
        <span className="brand-copy">DailyProof</span>
      </button>
      <nav className="topnav">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>
          <Home size={20} />
          <span>Home</span>
        </button>
        {user && (
          <>
            <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
              <ClipboardList size={20} />
              <span>Dashboard</span>
            </button>
            <button className={view === "records" ? "active" : ""} onClick={() => setView("records")}>
              <FilePenLine size={20} />
              <span>Records</span>
            </button>
            <button className={view === "stats" ? "active" : ""} onClick={() => setView("stats")}>
              <BarChart3 size={20} />
              <span>Analytics</span>
            </button>
            <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>
              <CalendarDays size={20} />
              <span>Calendar</span>
            </button>
          </>
        )}
      </nav>
      <div className="account">
        <div className="theme-switch" aria-label="主题选择">
          {themes.map((item) => (
            <button key={item.id} className={theme === item.id ? "active" : ""} onClick={() => setTheme(item.id)} title={item.label}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        {user ? (
          <>
            <span className="user-pill">
              <UserRound size={15} /> {user.name}
            </span>
            <button className="icon-btn" onClick={logout} title="退出">
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <span className="api-chip">{API_BASE}</span>
        )}
      </div>
    </header>
  );
}

function Landing({
  user,
  onAuthed,
  onEnterApp,
  onOpenRecords,
  onOpenAnalytics
}: {
  user: User | null;
  onAuthed: (user: User) => void;
  onEnterApp: () => void;
  onOpenRecords: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <main className="home-page">
      <section className="hero home-hero" style={{ backgroundImage: `var(--home-hero-overlay), url(${heroUrl})` }}>
        <div className="hero-content home-hero-copy">
          <p className="eyebrow"><span /> Proof before promise</p>
          <h1>
            把每天变成
            <span>可见的证据。</span>
          </h1>
          <p className="hero-copy">
            DailyProof 把月计划拆成轻盈的每日节奏：专注、刷题、复盘和正确率都被记录下来，让进步不再靠感觉，而是被清晰地看见。
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#auth">
              进入系统 <ChevronRight size={18} />
            </a>
            <a className="ghost-link" href="#guide">
              查看流程
            </a>
          </div>
          <div className="home-proof-strip" aria-label="DailyProof 工作流预览">
            <span><b>01</b> 月计划自动拆解</span>
            <span><b>27min</b> 控制单套用时</span>
            <span><b>90%</b> 追踪正确率目标</span>
          </div>
        </div>
        {user ? (
          <SignedInHomePanel user={user} onEnterApp={onEnterApp} onOpenRecords={onOpenRecords} onOpenAnalytics={onOpenAnalytics} />
        ) : (
          <AuthPanel onAuthed={onAuthed} />
        )}
      </section>

      <section id="guide" className="guide-band home-guide">
        <div className="section-head">
          <p className="eyebrow"><span /> Daily operating system</p>
          <h2>目标不是一句口号，而是一组每天可验证的数据。</h2>
        </div>
        <div className="guide-grid">
          {[
            ["定月计划", "输入目标、时段和复盘要求，系统把月目标拆成每天可执行的任务节奏。"],
            ["两类任务", "事项一键完成，刷题任务记录题量、正确率、用时和标签，复盘更有依据。"],
            ["趋势统计", "按资料分析、数量关系、言语理解等标签汇总日、周、月和总数据。"],
            ["日历回看", "像翻日历一样看见每天的完成率、刷题量和任务轨迹。"]
          ].map(([title, text], index) => (
            <article className="guide-card" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SignedInHomePanel({
  user,
  onEnterApp,
  onOpenRecords,
  onOpenAnalytics
}: {
  user: User;
  onEnterApp: () => void;
  onOpenRecords: () => void;
  onOpenAnalytics: () => void;
}) {
  return (
    <aside className="auth-panel signed-home-panel">
      <div className="signed-home-mark">
        <span>D</span>
        <div>
          <b>欢迎回来</b>
          <p>{user.name}</p>
        </div>
      </div>
      <div className="signed-home-copy">
        <h2>继续把今天变成证据。</h2>
        <p>从今日任务开始，完成刷题后再回到 Analytics 看每次用时和正确率的变化。</p>
      </div>
      <div className="signed-home-actions">
        <button className="primary-btn" onClick={onEnterApp}>
          <ClipboardList size={18} /> 今日任务
        </button>
        <button className="ghost-btn" onClick={onOpenRecords}>
          <FilePenLine size={18} /> 做题记录
        </button>
        <button className="ghost-btn" onClick={onOpenAnalytics}>
          <BarChart3 size={18} /> 查看统计
        </button>
      </div>
      <div className="signed-home-stats">
        <span><b>27min</b> 单套目标</span>
        <span><b>90%</b> 正确率目标</span>
      </div>
    </aside>
  );
}

function AuthPanel({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@dailyproof.cn");
  const [password, setPassword] = useState("DailyProof@2026");
  const [name, setName] = useState("DailyProof 用户");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const nextUser = mode === "login" ? await login(email, password) : await register(email, password, name);
      onAuthed(nextUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const useDemo = () => {
    setMode("login");
    setEmail("demo@dailyproof.cn");
    setPassword("Demo@2026");
  };

  return (
    <aside id="auth" className="auth-panel">
      <div className="segmented">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          登录
        </button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
          注册
        </button>
      </div>
      {mode === "register" && (
        <label>
          昵称
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      )}
      <label>
        邮箱
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        密码
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-btn" onClick={submit} disabled={loading}>
        {loading ? "处理中..." : mode === "login" ? "进入 DailyProof" : "创建账号"}
      </button>
      <button className="text-btn" onClick={useDemo}>
        使用体验账号
      </button>
      <div className="default-account">
        <b>默认账号</b>
        <span>管理员：admin@dailyproof.cn / DailyProof@2026</span>
        <span>用户：demo@dailyproof.cn / Demo@2026</span>
      </div>
    </aside>
  );
}

function asPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value}%`;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function weightedAccuracy(records: Array<{ question_count: number; correct_count: number; accuracy?: number | null }>) {
  const questions = records.reduce((sum, record) => sum + Number(record.question_count || 0), 0);
  const correct = records.reduce((sum, record) => sum + Number(record.correct_count || 0), 0);
  if (questions > 0) return Math.round((correct * 1000) / questions) / 10;
  const values = records.map((record) => record.accuracy).filter((value): value is number => value !== null && value !== undefined);
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) * 10) / values.length) / 10 : null;
}

function weightedDailyAccuracy(days: MonthlyStats["daily"]) {
  const activeDays = days.filter((day) => day.accuracy !== null && day.question_count > 0);
  const questions = activeDays.reduce((sum, day) => sum + day.question_count, 0);
  const correct = activeDays.reduce((sum, day) => sum + (Number(day.accuracy || 0) * day.question_count) / 100, 0);
  return questions > 0 ? Math.round((correct * 1000) / questions) / 10 : null;
}

function buildTaskAnalyticsSignals(stats: MonthlyStats | null) {
  const daily = stats?.daily || [];
  const activeDays = daily.filter((day) => day.practice_task_count > 0 || day.question_count > 0);
  const recentDays = activeDays.slice(-7);
  const movingAverage = weightedDailyAccuracy(recentDays);
  const targetDays = activeDays.filter((day) => (day.accuracy ?? -1) >= 90).length;
  const targetRate = activeDays.length ? Math.round((targetDays * 1000) / activeDays.length) / 10 : null;
  const efficiency = stats?.practice_minutes ? Math.round((Number(stats.question_total || 0) / Number(stats.practice_minutes || 1)) * 100) / 100 : null;
  return { movingAverage, targetRate, efficiency };
}

function buildRecordAnalyticsSignals(stats: PracticeRecordStats | null) {
  const records = stats?.records || [];
  const recentRecords = records.slice(0, 7).reverse();
  const movingAverage = weightedAccuracy(recentRecords);
  const targetRecords = records.filter((record) => record.accuracy >= 90).length;
  const targetRate = records.length ? Math.round((targetRecords * 1000) / records.length) / 10 : null;
  const minutes = Number(stats?.summary.minutes || 0);
  const efficiency = minutes > 0 ? Math.round((Number(stats?.summary.correct_count || 0) / minutes) * 100) / 100 : null;
  return { movingAverage, targetRate, efficiency };
}

function buildTodayReview(daily: DailyPlan | null, monthly: MonthlyStats | null, records: PracticeRecordStats | null, plan: MonthlyPlan | undefined) {
  const todayStats = monthly?.daily.find((item) => item.date === daily?.date);
  const completion = daily?.completion_rate || 0;
  const unfinished = Math.max(0, (daily?.tasks_total || 0) - (daily?.tasks_done || 0));
  const practiceRecords = records?.records || [];
  const todayRecords = practiceRecords.filter((record) => record.date === daily?.date);
  const weakest = records?.category_summary
    .filter((row) => row.record_count > 0 && row.accuracy !== null)
    .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))[0];
  const topIssue = records?.issue_summary?.[0];
  const nextAction =
    unfinished > 0
      ? `先完成剩余 ${unfinished} 个任务，再做一次简短复盘。`
      : weakest
        ? `下一轮优先练 ${weakest.label}，目标把正确率拉回 90%。`
        : "今天先补一条做题记录，让趋势开始累计。";

  return {
    completion,
    todayQuestions: todayStats?.question_count || todayRecords.reduce((sum, record) => sum + record.question_count, 0),
    todayAccuracy: todayStats?.accuracy ?? weightedAccuracy(todayRecords),
    todayMinutes: todayStats?.practice_minutes || todayRecords.reduce((sum, record) => sum + record.minutes, 0),
    planTarget: plan ? `${plan.target_minutes}min / ${plan.target_accuracy}%` : "等待月计划",
    weakLabel: weakest ? `${weakest.label} ${asPercent(weakest.accuracy)}` : "暂无弱项",
    issueLabel: topIssue ? `${topIssue.label} · ${topIssue.count} 次` : "暂无高频错因",
    nextAction
  };
}

function buildCoachReport(monthly: MonthlyStats | null, records: PracticeRecordStats | null) {
  const recordSignals = buildRecordAnalyticsSignals(records);
  const taskSignals = buildTaskAnalyticsSignals(monthly);
  const activeCategories = records?.category_summary.filter((row) => row.record_count > 0) || [];
  const weakest = [...activeCategories]
    .filter((row) => row.accuracy !== null)
    .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))[0];
  const topIssue = records?.issue_summary?.[0];
  const trendRows = records?.periods.filter((row) => row.record_count > 0 && row.accuracy !== null) || [];
  const latest = trendRows[trendRows.length - 1];
  const previous = trendRows[trendRows.length - 2];
  const delta = latest && previous ? Math.round((Number(latest.accuracy) - Number(previous.accuracy)) * 10) / 10 : null;

  return [
    {
      title: "本周结论",
      value: records?.summary.record_count ? `${records.summary.record_count} 次记录` : `${monthly?.tasks_done || 0}/${monthly?.tasks_total || 0} 任务`,
      detail: records?.summary.record_count
        ? `加权正确率 ${asPercent(records.summary.accuracy)}，达标率 ${asPercent(recordSignals.targetRate)}，效率 ${recordSignals.efficiency ?? "-"} 对/min。`
        : `先积累 3 次做题记录，AI 教练会给出更稳定的板块建议。`
    },
    {
      title: "训练建议",
      value: weakest ? weakest.label : "先补记录",
      detail: weakest
        ? `当前最低板块是 ${weakest.label}，建议下一次用 15-25 分钟做限时专项，再记录错因。`
        : `本月 7 日移动正确率为 ${asPercent(taskSignals.movingAverage)}，先从资料分析或数量关系开始建立样本。`
    },
    {
      title: "证据",
      value: topIssue ? topIssue.label : delta !== null ? `${formatSigned(delta)}%` : "等待样本",
      detail: topIssue
        ? `${topIssue.label} 是当前最高频错因，共 ${topIssue.count} 次。建议备注里继续写明题型和触发原因。`
        : delta !== null
          ? `最近两个统计周期正确率变化 ${formatSigned(delta)}%，可以用来判断复盘是否有效。`
          : "系统会根据题量、正确数、用时和错因标签给出可解释建议。"
    }
  ];
}

function TodayReviewPanel({
  daily,
  monthly,
  records,
  plan
}: {
  daily: DailyPlan | null;
  monthly: MonthlyStats | null;
  records: PracticeRecordStats | null;
  plan: MonthlyPlan | undefined;
}) {
  const review = buildTodayReview(daily, monthly, records, plan);
  return (
    <section className="panel today-review-panel">
      <div className="panel-title">
        <h2>今日复盘中枢</h2>
        <span>Review hub</span>
      </div>
      <div className="today-review-grid">
        <article className="today-review-main">
          <span>下一步</span>
          <b>{review.nextAction}</b>
          <p>目标口径：{review.planTarget}</p>
        </article>
        <article>
          <span>今日完成</span>
          <b>{review.completion}%</b>
          <p>{review.todayQuestions} 题 · {asPercent(review.todayAccuracy)} · {review.todayMinutes}min</p>
        </article>
        <article>
          <span>优先板块</span>
          <b>{review.weakLabel}</b>
          <p>{review.issueLabel}</p>
        </article>
      </div>
    </section>
  );
}

function CoachReportPanel({ monthly, records }: { monthly: MonthlyStats | null; records: PracticeRecordStats | null }) {
  const report = buildCoachReport(monthly, records);
  return (
    <section className="panel coach-report-panel">
      <div className="panel-title">
        <h2>AI 周报</h2>
        <span>Evidence coach</span>
      </div>
      <div className="coach-report-grid">
        {report.map((item) => (
          <article key={item.title}>
            <span>{item.title}</span>
            <b>{item.value}</b>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ user, toast }: { user: User; toast: (message: string) => void }) {
  const [daily, setDaily] = useState<DailyPlan | null>(null);
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [recordStats, setRecordStats] = useState<PracticeRecordStats | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const refresh = async () => {
    setLoading(true);
    try {
      const [dailyData, planData, statsData, recordStatsData] = await Promise.all([
        api<{ daily_plan: DailyPlan | null }>("/daily"),
        api<MonthlyPlan[]>(`/plans/monthly?year=${year}&month=${month}`),
        api<MonthlyStats>(`/stats/monthly?year=${year}&month=${month}`),
        api<PracticeRecordStats>(`/practice-records/stats?scope=week&year=${year}&month=${month}`)
      ]);
      setDaily(dailyData.daily_plan);
      setPlans(planData);
      setStats(statsData);
      setRecordStats(recordStatsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const patchTask = async (task: Task, payload: TaskPatchPayload) => {
    let updated: Task;
    try {
      updated = await api<Task>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "任务更新失败");
      throw err;
    }
    setDaily((current) => {
      if (!current) return current;
      const tasks = current.tasks.map((item) => (item.id === updated.id ? updated : item));
      const done = tasks.filter((item) => item.status === "done").length;
      return {
        ...current,
        tasks,
        tasks_done: done,
        completion_rate: Math.round((done * 1000) / Math.max(1, tasks.length)) / 10
      };
    });
    if (payload.status === "done") toast("任务已记录完成");
    if (
      payload.result_accuracy !== undefined ||
      payload.result_question_count !== undefined ||
      payload.result_minutes !== undefined ||
      payload.note !== undefined
    ) {
      toast("结果已保存");
    }
    api<MonthlyStats>(`/stats/monthly?year=${year}&month=${month}`).then(setStats).catch(() => undefined);
    api<PracticeRecordStats>(`/practice-records/stats?scope=week&year=${year}&month=${month}`).then(setRecordStats).catch(() => undefined);
  };

  const todayStats = stats?.daily.find((item) => item.date === daily?.date);
  const currentPlan = plans[0];
  const proofDate = daily?.date ? new Date(`${daily.date}T00:00:00`) : today;
  const displayDate = `${proofDate.getFullYear()}. ${String(proofDate.getMonth() + 1).padStart(2, "0")}. ${String(proofDate.getDate()).padStart(2, "0")}`;
  const weekday = proofDate.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <main className="workspace dashboard-workspace">
      <div className="page-head dashboard-head">
        <div className="page-copy">
          <p className="eyebrow"><span /> Today proof</p>
          <h1>
            让今天成为一枚
            <span className="headline-gradient">清晰的证据。</span>
          </h1>
          <p className="page-subtitle">像呼吸一样推进计划：轻盈开始，专注执行，把每一段时间都沉淀成看得见的证据。</p>
        </div>
        <div className="head-actions date-card">
          <b>{displayDate}</b>
          <span>{weekday}, keep going!</span>
          <button className="primary-btn compact" onClick={refresh}>
            <RefreshCw size={17} /> 同步
          </button>
        </div>
      </div>
      <div className="metric-grid dashboard-metrics">
        <Metric icon={<ClipboardList />} label="今日进度" value={`${daily?.tasks_done || 0}/${daily?.tasks_total || 0}`} />
        <Metric icon={<TimerReset />} label="专注时长" value={`${stats?.practice_minutes || 0}min`} />
        <Metric icon={<BarChart3 />} label="平均正确率" value={`${stats?.avg_accuracy || 0}%`} />
        <Metric icon={<BookOpen />} label="月刷题量" value={`${stats?.question_total || 0}`} />
      </div>

      <TodayReviewPanel daily={daily} monthly={stats} records={recordStats} plan={currentPlan} />

      <div className="workspace-grid">
        <section className="panel main-panel">
          <div className="panel-title">
            <h2>今日计划 <span>(Today)</span></h2>
            <button className="soft-action" onClick={refresh}>
              <RefreshCw size={17} /> 同步节奏
            </button>
          </div>
          {loading && <div className="empty-state">正在读取今日节奏...</div>}
          {!loading && !daily && <div className="empty-state">还没有当前月份计划，先创建一个月计划。</div>}
          <div className="task-list">
            {daily?.tasks.map((task) => (
              <TaskRow key={task.id} task={task} onPatch={(payload) => patchTask(task, payload)} toast={toast} />
            ))}
          </div>
        </section>

        <aside className="side-stack">
          <section className="panel goal-card">
            <div className="panel-title">
              <h2>{month}月月度目标</h2>
              <span>On Track</span>
            </div>
            {currentPlan ? (
              <>
                <p>"{currentPlan.objective}"</p>
                <div className="goal-progress">
                  <div>
                    <span>Time Ctrl Progress</span>
                    <b>{stats?.completion_rate || 0}%</b>
                  </div>
                  <i><em style={{ width: `${Math.min(100, stats?.completion_rate || 0)}%` }} /></i>
                </div>
                <div className="goal-progress violet">
                  <div>
                    <span>Accuracy Goal</span>
                    <b>{currentPlan.target_accuracy}%</b>
                  </div>
                  <i><em style={{ width: `${Math.min(100, currentPlan.target_accuracy || 0)}%` }} /></i>
                </div>
              </>
            ) : (
              <p>创建一个月计划后，这里会展示你的目标、进度与节奏控制。</p>
            )}
          </section>
          <PlanComposer onCreated={refresh} toast={toast} />
          <section className="panel">
            <div className="panel-title">
              <h2>今日刷题标签</h2>
              <span>{todayStats?.practice_task_count || 0} 项</span>
            </div>
            {todayStats?.tag_summary?.length ? (
              <div className="tag-stack compact-tags">
                {todayStats.tag_summary.map((row) => (
                  <div className="tag-row" key={row.tag}>
                    <b>{row.label}</b>
                    <span>{row.question_count} 题</span>
                    <span>{row.accuracy === null ? "-" : `${row.accuracy}%`}</span>
                    <span>{row.minutes}min</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state small">完成刷题任务后，这里会显示当天各标签的题量、正确率和用时。</div>
            )}
          </section>
          <section className="panel weekly-card">
            <div className="panel-title">
              <h2>当前月计划</h2>
              <span>{plans.length} 个</span>
            </div>
            {plans.map((plan) => (
              <div className="plan-mini" key={plan.id}>
                <b>{plan.title}</b>
                <p>{plan.objective}</p>
                <div>
                  <span>{plan.target_minutes}min 目标</span>
                  <span>{plan.target_accuracy}% 正确率</span>
                  <span>{plan.blocks.length} 个模板</span>
                  <span>{plan.blocks.filter((block) => block.task_type === "practice").length} 个刷题</span>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span>{icon}</span>
      <p>{label}</p>
      <b>{value}</b>
    </div>
  );
}

type ChartPoint = {
  x: number;
  y: number;
  point: PracticeTrendPoint;
};

function buildLinePath(points: ChartPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function PracticeTrendChart({ title, points }: { title: string; points: PracticeTrendPoint[] }) {
  const chartWidth = 640;
  const chartHeight = 260;
  const pad = { top: 22, right: 58, bottom: 42, left: 48 };
  const plotWidth = chartWidth - pad.left - pad.right;
  const plotHeight = chartHeight - pad.top - pad.bottom;
  const bottom = pad.top + plotHeight;
  const targetMinutes = points.find((point) => point.target_minutes)?.target_minutes || null;
  const maxMinutes = Math.max(
    10,
    Math.ceil(
      points.reduce((max, point) => Math.max(max, Number(point.minutes || 0), Number(point.target_minutes || 0)), targetMinutes || 0) / 5
    ) * 5
  );
  const getX = (index: number) => pad.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const minutesPoints = points.map((point, index) => ({
    x: getX(index),
    y: pad.top + (1 - Math.min(maxMinutes, Number(point.minutes || 0)) / maxMinutes) * plotHeight,
    point
  }));
  const accuracyPoints = points
    .map((point, index) =>
      point.accuracy === null
        ? null
        : {
            x: getX(index),
            y: pad.top + (1 - Math.min(100, Math.max(0, Number(point.accuracy))) / 100) * plotHeight,
            point
          }
    )
    .filter((point): point is ChartPoint => Boolean(point));
  const tickEvery = Math.max(1, Math.ceil(points.length / 6));
  const tickRows = points
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => index === 0 || index === points.length - 1 || index % tickEvery === 0);
  const targetMinutesY = targetMinutes ? pad.top + (1 - Math.min(maxMinutes, targetMinutes) / maxMinutes) * plotHeight : null;
  const targetAccuracyY = pad.top + 0.1 * plotHeight;
  const recentPoints = points.slice(-4);

  return (
    <section className="panel attempt-chart-panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <span>{points.length} 次记录</span>
      </div>
      {points.length ? (
        <>
          <div className="attempt-chart-wrap">
            <svg className="attempt-line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${title}每次用时和正确率折线统计图`}>
              <line className="attempt-axis" x1={pad.left} y1={pad.top} x2={pad.left} y2={bottom} />
              <line className="attempt-axis" x1={pad.left} y1={bottom} x2={chartWidth - pad.right} y2={bottom} />
              <line className="attempt-grid-line" x1={pad.left} y1={pad.top} x2={chartWidth - pad.right} y2={pad.top} />
              <line className="attempt-grid-line" x1={pad.left} y1={pad.top + plotHeight / 2} x2={chartWidth - pad.right} y2={pad.top + plotHeight / 2} />
              {targetMinutesY !== null && (
                <line className="attempt-target minutes-target" x1={pad.left} y1={targetMinutesY} x2={chartWidth - pad.right} y2={targetMinutesY} />
              )}
              <line className="attempt-target accuracy-target" x1={pad.left} y1={targetAccuracyY} x2={chartWidth - pad.right} y2={targetAccuracyY} />
              <text className="attempt-y-label" x={10} y={pad.top + 5}>{maxMinutes}min</text>
              <text className="attempt-y-label" x={18} y={bottom}>{0}min</text>
              <text className="attempt-y-label right" x={chartWidth - 43} y={pad.top + 5}>100%</text>
              <text className="attempt-y-label right" x={chartWidth - 33} y={bottom}>0%</text>
              {targetMinutesY !== null && <text className="attempt-target-label minutes-label" x={pad.left + 8} y={targetMinutesY - 6}>{targetMinutes}min</text>}
              <text className="attempt-target-label accuracy-label" x={chartWidth - pad.right - 42} y={targetAccuracyY - 6}>90%</text>
              <path className="attempt-line minutes-line" d={buildLinePath(minutesPoints)} />
              <path className="attempt-line accuracy-line" d={buildLinePath(accuracyPoints)} />
              {minutesPoints.map(({ x, y, point }) => (
                <circle className="attempt-dot minutes-dot" key={`minutes-${point.id}`} cx={x} cy={y} r={4.2}>
                  <title>{`${point.date} 第 ${point.sequence} 次：用时 ${point.minutes}min，正确率 ${point.accuracy ?? "-"}%，${point.question_count} 题`}</title>
                </circle>
              ))}
              {accuracyPoints.map(({ x, y, point }) => (
                <circle className="attempt-dot accuracy-dot" key={`accuracy-${point.id}`} cx={x} cy={y} r={4.2}>
                  <title>{`${point.date} 第 ${point.sequence} 次：正确率 ${point.accuracy ?? "-"}%，用时 ${point.minutes}min，${point.question_count} 题`}</title>
                </circle>
              ))}
              {tickRows.map(({ point, index }) => (
                <text className="attempt-x-label" key={`tick-${point.id}`} x={getX(index)} y={chartHeight - 15}>
                  {point.sequence}
                </text>
              ))}
            </svg>
          </div>
          <div className="legend attempt-legend">
            <span><i className="minutes" />用时</span>
            <span><i className="accuracy" />正确率</span>
            <span><i className="target" />目标线</span>
          </div>
          <div className="attempt-mini-list">
            {recentPoints.map((point) => (
              <div className="attempt-mini-row" key={point.id}>
                <b>#{point.sequence}</b>
                <span>{point.date.slice(5)}</span>
                <span>{point.minutes}min</span>
                <span>{point.accuracy ?? "-"}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state small">{title}暂无完成记录，完成刷题任务后会显示每次趋势。</div>
      )}
    </section>
  );
}

type RecordScope = "week" | "month";
type RecordMetric = "minutes" | "accuracy";
type AnalyticsMode = "tasks" | "records";
type RecordRangePreset = "this_week" | "last_week" | "this_month" | "last_month" | "last_30" | "last_90" | "custom";
type RecordInsight = {
  title: string;
  value: string;
  detail: string;
  tone?: "attention" | "steady" | "lift";
};
type RecordRange = {
  label: string;
  start: string;
  end: string;
};
type TrendAlert = {
  title: string;
  value: string;
  detail: string;
  tone?: "attention" | "steady" | "lift";
};

const recordRangeOptions: Array<{ value: RecordRangePreset; label: string }> = [
  { value: "this_week", label: "本周" },
  { value: "last_week", label: "上周" },
  { value: "this_month", label: "本月" },
  { value: "last_month", label: "上月" },
  { value: "last_30", label: "近 30 天" },
  { value: "last_90", label: "近 90 天" },
  { value: "custom", label: "自定义" }
];

function categoryColor(category: string) {
  const index = Math.max(0, recordCategories.findIndex((item) => item.category === category));
  return recordColors[index % recordColors.length];
}

function formatRecordAccuracy(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value}%`;
}

function buildEmptyRecordCategories() {
  return recordCategories.map((item) => ({
    category: item.category,
    label: item.label,
    record_count: 0,
    question_count: 0,
    correct_count: 0,
    minutes: 0,
    accuracy: null,
    issue_summary: [],
    trend: []
  }));
}

function dateFromKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months, 1);
  return next;
}

function startOfWeek(value: Date) {
  const next = new Date(value);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function endOfWeek(value: Date) {
  return addDays(startOfWeek(value), 6);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function resolveRecordRange(preset: RecordRangePreset, customStart: string, customEnd: string, today: Date): RecordRange {
  if (preset === "custom") {
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { label: `${start} 至 ${end}`, start, end };
  }
  if (preset === "this_week") {
    return { label: "本周", start: toDateKey(startOfWeek(today)), end: toDateKey(endOfWeek(today)) };
  }
  if (preset === "last_week") {
    const lastWeek = addDays(startOfWeek(today), -7);
    return { label: "上周", start: toDateKey(lastWeek), end: toDateKey(addDays(lastWeek, 6)) };
  }
  if (preset === "this_month") {
    return { label: "本月", start: toDateKey(startOfMonth(today)), end: toDateKey(endOfMonth(today)) };
  }
  if (preset === "last_month") {
    const lastMonth = addMonths(startOfMonth(today), -1);
    return { label: "上月", start: toDateKey(lastMonth), end: toDateKey(endOfMonth(lastMonth)) };
  }
  const days = preset === "last_90" ? 89 : 29;
  return { label: preset === "last_90" ? "近 90 天" : "近 30 天", start: toDateKey(addDays(today, -days)), end: toDateKey(today) };
}

function comparisonDelta(current: number | null | undefined, previous: number | null | undefined, suffix = "") {
  if (current === null || current === undefined || previous === null || previous === undefined) return "-";
  const delta = Math.round((Number(current) - Number(previous)) * 10) / 10;
  return `${delta >= 0 ? "+" : ""}${delta}${suffix}`;
}

function comparisonTone(current: number | null | undefined, previous: number | null | undefined, lowerIsBetter = false) {
  if (current === null || current === undefined || previous === null || previous === undefined || Number(current) === Number(previous)) return "neutral";
  const improved = lowerIsBetter ? Number(current) < Number(previous) : Number(current) > Number(previous);
  return improved ? "positive" : "negative";
}

function efficiencyFromSummary(summary: PracticeRecordPeriodSummary | undefined) {
  if (!summary?.minutes) return null;
  return Math.round((Number(summary.correct_count || 0) / Number(summary.minutes || 1)) * 100) / 100;
}

function buildRecordInsights(stats: PracticeRecordStats | null): RecordInsight[] {
  if (!stats?.summary?.record_count) return [];

  const activeCategories = stats.category_summary.filter((row) => row.record_count > 0);
  const insights: RecordInsight[] = [];
  const weakest = [...activeCategories]
    .filter((row) => row.accuracy !== null)
    .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))[0];
  if (weakest) {
    const topIssue = weakest.issue_summary?.[0];
    insights.push({
      title: "优先补强",
      value: `${weakest.label} ${formatRecordAccuracy(weakest.accuracy)}`,
      detail: topIssue ? `主要错因是${topIssue.label}，先用 2-3 次专项复盘压低它。` : "当前加权正确率最低，适合下一轮做专项复盘。",
      tone: "attention"
    });
  }

  const slowest = [...activeCategories].sort((a, b) => Number(b.minutes || 0) - Number(a.minutes || 0))[0];
  if (slowest?.minutes) {
    insights.push({
      title: "时间消耗",
      value: `${slowest.label} ${slowest.minutes}min`,
      detail: "这是当前统计周期里累计用时最高的板块，可以拆出限时训练和复盘两段。",
      tone: "steady"
    });
  }

  const trendRows = stats.periods.filter((row) => row.record_count > 0 && row.accuracy !== null);
  if (trendRows.length >= 2) {
    const latest = trendRows[trendRows.length - 1];
    const previous = trendRows[trendRows.length - 2];
    const delta = Math.round((Number(latest.accuracy) - Number(previous.accuracy)) * 10) / 10;
    insights.push({
      title: delta >= 0 ? "趋势提升" : "趋势回落",
      value: `${delta >= 0 ? "+" : ""}${delta}%`,
      detail: `${previous.label} 到 ${latest.label} 的加权正确率变化，适合作为本轮复盘的反馈。`,
      tone: delta >= 0 ? "lift" : "attention"
    });
  }

  const topIssue = stats.issue_summary?.[0];
  if (topIssue) {
    insights.push({
      title: "高频错因",
      value: topIssue.label,
      detail: `本周期出现 ${topIssue.count} 次，建议在备注里继续细分题型和触发场景。`,
      tone: "steady"
    });
  }

  return insights.slice(0, 4);
}

function RecordInsightPanel({ stats }: { stats: PracticeRecordStats | null }) {
  const insights = buildRecordInsights(stats);
  return (
    <section className="panel record-insight-panel">
      <div className="panel-title">
        <h2>弱项提示</h2>
        <span>Auto review</span>
      </div>
      {insights.length ? (
        <div className="record-insight-grid">
          {insights.map((item) => (
            <article className={`record-insight-card ${item.tone || "steady"}`} key={`${item.title}-${item.value}`}>
              <span>{item.title}</span>
              <b>{item.value}</b>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state small">记录几次题量、正确数和错因后，这里会自动给出优先复盘方向。</div>
      )}
    </section>
  );
}

function buildTrendAlerts(stats: PracticeRecordStats | null): TrendAlert[] {
  if (!stats?.summary.record_count) {
    return [
      {
        title: "样本不足",
        value: "暂无记录",
        detail: "当前范围还没有做题记录，先记录 3 次以上后再判断趋势。",
        tone: "steady"
      }
    ];
  }
  const alerts: TrendAlert[] = [];
  const records = stats.records;
  if (stats.summary.record_count < 3) {
    alerts.push({
      title: "样本偏少",
      value: `${stats.summary.record_count} 次`,
      detail: "当前范围记录少于 3 次，趋势判断仅作提示，建议继续补充样本。",
      tone: "steady"
    });
  }

  const latestThree = records.slice(0, 3);
  if (latestThree.length >= 3 && latestThree[0].accuracy < latestThree[1].accuracy && latestThree[1].accuracy < latestThree[2].accuracy) {
    alerts.push({
      title: "连续下滑",
      value: `${latestThree[2].accuracy}% → ${latestThree[0].accuracy}%`,
      detail: "最近 3 次正确率连续下降，建议暂停加量，先复盘错因和题型。",
      tone: "attention"
    });
  }

  const latest = records[0];
  const baseline = records.slice(1, 8);
  if (latest && baseline.length >= 3) {
    const avgMinutes = baseline.reduce((sum, record) => sum + Number(record.minutes || 0), 0) / baseline.length;
    if (avgMinutes > 0 && latest.minutes > avgMinutes * 1.35 && latest.minutes - avgMinutes >= 5) {
      alerts.push({
        title: "用时异常",
        value: `${latest.minutes}min`,
        detail: `${latest.label} 最新一次用时显著高于近几次均值，可能需要拆分限时训练。`,
        tone: "attention"
      });
    }
  }

  const activePeriods = stats.periods.filter((period) => period.record_count > 0 && period.accuracy !== null);
  const currentPeriod = activePeriods[activePeriods.length - 1];
  const previousPeriod = activePeriods[activePeriods.length - 2];
  if (currentPeriod && previousPeriod) {
    const delta = Math.round((Number(currentPeriod.accuracy) - Number(previousPeriod.accuracy)) * 10) / 10;
    if (delta <= -5) {
      alerts.push({
        title: "周期回落",
        value: `${delta}%`,
        detail: `${previousPeriod.label} 到 ${currentPeriod.label} 正确率明显下降，建议查看该周期记录明细。`,
        tone: "attention"
      });
    } else if (delta >= 5) {
      alerts.push({
        title: "趋势改善",
        value: `+${delta}%`,
        detail: `${previousPeriod.label} 到 ${currentPeriod.label} 正确率明显提升，可以保留当前训练节奏。`,
        tone: "lift"
      });
    }
  }

  const topIssue = stats.issue_summary?.[0];
  if (topIssue && topIssue.count >= Math.max(3, Math.ceil(stats.summary.record_count * 0.35))) {
    alerts.push({
      title: "错因集中",
      value: topIssue.label,
      detail: `${topIssue.label} 在当前范围出现 ${topIssue.count} 次，建议单独做一次错因复盘。`,
      tone: "attention"
    });
  }

  const weakest = stats.category_summary
    .filter((row) => row.record_count >= 2 && row.accuracy !== null)
    .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))[0];
  if (weakest && Number(weakest.accuracy) < 75) {
    alerts.push({
      title: "低位板块",
      value: `${weakest.label} ${weakest.accuracy}%`,
      detail: "该板块正确率低于 75%，适合先做基础题型归纳，再做限时训练。",
      tone: "attention"
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "趋势稳定",
      value: "无明显异常",
      detail: "当前范围没有检测到连续下滑、用时突增或错因异常集中。",
      tone: "lift"
    });
  }
  return alerts.slice(0, 4);
}

function TrendAlertPanel({ stats }: { stats: PracticeRecordStats | null }) {
  const alerts = buildTrendAlerts(stats);
  return (
    <section className="panel trend-alert-panel">
      <div className="panel-title">
        <h2>异常检测与趋势提醒</h2>
        <span>Anomaly scan</span>
      </div>
      <div className="trend-alert-grid">
        {alerts.map((alert) => (
          <article className={`trend-alert-card ${alert.tone || "steady"}`} key={`${alert.title}-${alert.value}`}>
            <span>{alert.title}</span>
            <b>{alert.value}</b>
            <p>{alert.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComparisonPanel({
  weekCurrent,
  weekPrevious,
  monthCurrent,
  monthPrevious
}: {
  weekCurrent: PracticeRecordStats | null;
  weekPrevious: PracticeRecordStats | null;
  monthCurrent: PracticeRecordStats | null;
  monthPrevious: PracticeRecordStats | null;
}) {
  const comparisons = [
    { title: "本周 vs 上周", current: weekCurrent, previous: weekPrevious },
    { title: "本月 vs 上月", current: monthCurrent, previous: monthPrevious }
  ];
  return (
    <section className="panel comparison-panel">
      <div className="panel-title">
        <h2>环比对比</h2>
        <span>Week / Month</span>
      </div>
      <div className="comparison-grid">
        {comparisons.map(({ title, current, previous }) => {
          const currentSummary = current?.summary;
          const previousSummary = previous?.summary;
          const currentEfficiency = efficiencyFromSummary(currentSummary);
          const previousEfficiency = efficiencyFromSummary(previousSummary);
          return (
            <article className="comparison-card" key={title}>
              <div>
                <span>{title}</span>
                <b>{formatRecordAccuracy(currentSummary?.accuracy)}</b>
                <em className={comparisonTone(currentSummary?.accuracy, previousSummary?.accuracy)}>
                  {comparisonDelta(currentSummary?.accuracy, previousSummary?.accuracy, "%")}
                </em>
              </div>
              <dl>
                <dt>记录</dt>
                <dd>{currentSummary?.record_count || 0} 次 <i className={comparisonTone(currentSummary?.record_count, previousSummary?.record_count)}>{comparisonDelta(currentSummary?.record_count, previousSummary?.record_count)}</i></dd>
                <dt>题量</dt>
                <dd>{currentSummary?.question_count || 0} 题 <i className={comparisonTone(currentSummary?.question_count, previousSummary?.question_count)}>{comparisonDelta(currentSummary?.question_count, previousSummary?.question_count)}</i></dd>
                <dt>用时</dt>
                <dd>{currentSummary?.minutes || 0}min <i className={comparisonTone(currentSummary?.minutes, previousSummary?.minutes, true)}>{comparisonDelta(currentSummary?.minutes, previousSummary?.minutes, "min")}</i></dd>
                <dt>效率</dt>
                <dd>{currentEfficiency ?? "-"} 对/min <i className={comparisonTone(currentEfficiency, previousEfficiency)}>{comparisonDelta(currentEfficiency, previousEfficiency)}</i></dd>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function buildRecordLinePath(points: Array<{ x: number; y: number | null }>) {
  let drawing = false;
  return points
    .map((point) => {
      if (point.y === null) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function RecordTrendChart({
  title,
  metric,
  stats
}: {
  title: string;
  metric: RecordMetric;
  stats: PracticeRecordStats | null;
}) {
  const periods = stats?.periods || [];
  const series = stats?.category_summary || [];
  const chartWidth = 760;
  const chartHeight = 280;
  const pad = { top: 24, right: 28, bottom: 46, left: 54 };
  const plotWidth = chartWidth - pad.left - pad.right;
  const plotHeight = chartHeight - pad.top - pad.bottom;
  const maxMinutes = Math.max(
    30,
    Math.ceil(Math.max(...series.flatMap((row) => row.trend.map((point) => Number(point.minutes || 0))), 0) / 10) * 10
  );
  const maxValue = metric === "accuracy" ? 100 : maxMinutes;
  const targetValue = metric === "accuracy" ? 90 : 27;
  const targetY = pad.top + (1 - Math.min(maxValue, targetValue) / maxValue) * plotHeight;
  const getX = (index: number) => pad.left + (periods.length <= 1 ? plotWidth / 2 : (index / (periods.length - 1)) * plotWidth);
  const getY = (value: number | null) => (value === null ? null : pad.top + (1 - Math.min(maxValue, Math.max(0, value)) / maxValue) * plotHeight);
  const visibleSeries = series.filter((row) => row.record_count > 0 || row.trend.some((point) => point.record_count > 0));
  const tickEvery = Math.max(1, Math.ceil(periods.length / 7));

  return (
    <section className="panel record-chart-panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <span>{metric === "accuracy" ? "正确率" : "用时"}趋势</span>
      </div>
      {visibleSeries.length ? (
        <>
          <div className="record-chart-wrap">
            <svg className="record-line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${title}${metric === "accuracy" ? "正确率" : "用时"}趋势图`}>
              <line className="record-axis" x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotHeight} />
              <line className="record-axis" x1={pad.left} y1={pad.top + plotHeight} x2={chartWidth - pad.right} y2={pad.top + plotHeight} />
              {[0, 0.5, 1].map((ratio) => (
                <line
                  className="record-grid-line"
                  key={ratio}
                  x1={pad.left}
                  y1={pad.top + plotHeight * ratio}
                  x2={chartWidth - pad.right}
                  y2={pad.top + plotHeight * ratio}
                />
              ))}
              <line className="record-target-line" x1={pad.left} y1={targetY} x2={chartWidth - pad.right} y2={targetY} />
              <text className="record-target-label" x={chartWidth - pad.right - 8} y={targetY - 7}>
                目标 {metric === "accuracy" ? "90%" : "27min"}
              </text>
              <text className="record-y-label" x={8} y={pad.top + 5}>{metric === "accuracy" ? "100%" : `${maxValue}min`}</text>
              <text className="record-y-label" x={18} y={pad.top + plotHeight}>{metric === "accuracy" ? "0%" : "0min"}</text>
              {visibleSeries.map((row) => {
                const color = categoryColor(row.category);
                const points = periods.map((period, index) => {
                  const item = row.trend.find((point) => point.period === period.period);
                  const value = metric === "accuracy" ? item?.accuracy ?? null : item?.minutes ?? 0;
                  return { x: getX(index), y: getY(value), item };
                });
                return (
                  <g key={row.category}>
                    <path className="record-line" d={buildRecordLinePath(points)} style={{ stroke: color }} />
                    {points
                      .filter((point) => point.y !== null && (point.item?.record_count || 0) > 0)
                      .map((point) => (
                        <circle className="record-dot" key={`${row.category}-${point.item?.period}`} cx={point.x} cy={point.y || 0} r={3.8} style={{ stroke: color }}>
                          <title>{`${row.label} ${point.item?.label}：用时 ${point.item?.minutes || 0}min，正确率 ${point.item?.accuracy ?? "-"}%，记录 ${point.item?.record_count || 0} 次`}</title>
                        </circle>
                      ))}
                  </g>
                );
              })}
              {periods
                .map((period, index) => ({ period, index }))
                .filter(({ index }) => index === 0 || index === periods.length - 1 || index % tickEvery === 0)
                .map(({ period, index }) => (
                  <text className="record-x-label" key={period.period} x={getX(index)} y={chartHeight - 16}>
                    {period.label}
                  </text>
                ))}
            </svg>
          </div>
          <div className="record-legend">
            {visibleSeries.map((row) => (
              <span key={row.category}>
                <i style={{ background: categoryColor(row.category) }} />
                {row.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state small">暂无记录，新增做题记录后这里会显示趋势。</div>
      )}
    </section>
  );
}

function PracticeRecordsPage({ toast }: { toast: (message: string) => void }) {
  const today = new Date();
  const [scope, setScope] = useState<RecordScope>("week");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [stats, setStats] = useState<PracticeRecordStats | null>(null);
  const [recordDate, setRecordDate] = useState(toDateKey(today));
  const [category, setCategory] = useState("verbal");
  const [questionCount, setQuestionCount] = useState("");
  const [correctCount, setCorrectCount] = useState("");
  const [minutes, setMinutes] = useState("");
  const [selectedIssueTags, setSelectedIssueTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const params = new URLSearchParams({ scope, year: String(year), month: String(month) });
    const nextStats = await api<PracticeRecordStats>(`/practice-records/stats?${params.toString()}`);
    setStats(nextStats);
  };

  useEffect(() => {
    refresh().catch((err) => toast(err instanceof Error ? err.message : "读取做题记录失败"));
  }, [scope, year, month]);

  const parsedQuestionPreview = Number(questionCount);
  const parsedCorrectPreview = Number(correctCount);
  const computedAccuracy =
    questionCount.trim() &&
    correctCount.trim() &&
    Number.isFinite(parsedQuestionPreview) &&
    Number.isFinite(parsedCorrectPreview) &&
    parsedQuestionPreview > 0 &&
    parsedCorrectPreview >= 0 &&
    parsedCorrectPreview <= parsedQuestionPreview
      ? Math.round((parsedCorrectPreview * 1000) / parsedQuestionPreview) / 10
      : null;

  const toggleIssueTag = (tag: string) => {
    setSelectedIssueTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const applyRecordTemplate = (template: (typeof recordTemplates)[number]) => {
    setCategory(template.category);
    setQuestionCount(String(template.questionCount));
    setCorrectCount(String(template.correctCount));
    setMinutes(String(template.minutes));
    setSelectedIssueTags(template.issueTags);
  };

  const reuseLastRecord = () => {
    const lastRecord = records[0];
    if (!lastRecord) {
      toast("还没有可复用的记录");
      return;
    }
    setCategory(lastRecord.category);
    setQuestionCount(String(lastRecord.question_count || ""));
    setCorrectCount(String(lastRecord.correct_count || ""));
    setMinutes(String(lastRecord.minutes || ""));
    setSelectedIssueTags(lastRecord.issue_tags || []);
    setNote("");
    toast("已复用上一条记录格式");
  };

  const submit = async () => {
    const parsedQuestionCount = Number(questionCount);
    const parsedCorrectCount = Number(correctCount);
    const parsedMinutes = Number(minutes);
    if (!recordDate) {
      toast("请选择记录日期");
      return;
    }
    if (!questionCount.trim() || !Number.isInteger(parsedQuestionCount) || parsedQuestionCount <= 0) {
      toast("请填写有效题量");
      return;
    }
    if (!correctCount.trim() || !Number.isInteger(parsedCorrectCount) || parsedCorrectCount < 0 || parsedCorrectCount > parsedQuestionCount) {
      toast("正确数不能超过题量");
      return;
    }
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      toast("请填写有效用时");
      return;
    }
    setSaving(true);
    try {
      await api<PracticeRecord>("/practice-records", {
        method: "POST",
        body: JSON.stringify({
          record_date: recordDate,
          category,
          question_count: parsedQuestionCount,
          correct_count: parsedCorrectCount,
          minutes: Math.round(parsedMinutes * 10) / 10,
          issue_tags: selectedIssueTags,
          note
        })
      });
      setQuestionCount("");
      setCorrectCount("");
      setMinutes("");
      setSelectedIssueTags([]);
      setNote("");
      toast("做题记录已保存");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "保存做题记录失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: PracticeRecord) => {
    if (!window.confirm(`删除 ${record.date} 的${record.label}记录？`)) return;
    try {
      await api(`/practice-records/${record.id}`, { method: "DELETE" });
      toast("记录已删除");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败");
    }
  };

  const records = stats?.records || [];
  const summary = stats?.summary;
  const categoryRows = stats?.category_summary || buildEmptyRecordCategories();
  const activeCategories = categoryRows.filter((row) => row.record_count > 0).length;

  return (
    <main className="workspace records-workspace">
      <div className="page-head records-head">
        <div>
          <p className="eyebrow">Practice records</p>
          <h1>把每一次做题，沉淀成可追踪的趋势。</h1>
        </div>
        <div className="record-scope-controls">
          <div className="segmented">
            <button className={scope === "week" ? "active" : ""} onClick={() => setScope("week")}>按周</button>
            <button className={scope === "month" ? "active" : ""} onClick={() => setScope("month")}>按月</button>
          </div>
          <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
          {scope === "week" && <input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />}
        </div>
      </div>

      <div className="metric-grid records-metrics">
        <Metric icon={<FilePenLine />} label="记录次数" value={`${summary?.record_count || 0}`} />
        <Metric icon={<BookOpen />} label="累计题量" value={`${summary?.question_count || 0}`} />
        <Metric icon={<TimerReset />} label="累计用时" value={`${summary?.minutes || 0}min`} />
        <Metric icon={<Gauge />} label="加权正确率" value={formatRecordAccuracy(summary?.accuracy)} />
        <Metric icon={<BarChart3 />} label="覆盖板块" value={`${activeCategories}/7`} />
      </div>

      <div className="records-layout">
        <section className="panel record-form-panel">
          <div className="panel-title">
            <h2>新增记录</h2>
            <span>Daily log</span>
          </div>
          <div className="record-template-strip">
            {recordTemplates.map((template) => (
              <button key={template.name} type="button" onClick={() => applyRecordTemplate(template)}>
                <b>{template.name}</b>
                <span>{template.questionCount} 题 · {template.minutes}min</span>
              </button>
            ))}
            <button className="reuse-record-btn" type="button" onClick={reuseLastRecord}>
              <Repeat2 size={15} />
              <span>复用上一条</span>
            </button>
          </div>
          <div className="record-form">
            <label>
              日期
              <input type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} />
            </label>
            <label>
              板块
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {recordCategories.map((item) => (
                  <option key={item.category} value={item.category}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              题量
              <input type="number" min={1} step={1} value={questionCount} placeholder="20" onChange={(event) => setQuestionCount(event.target.value)} />
            </label>
            <label>
              正确数
              <input
                type="number"
                min={0}
                max={questionCount || undefined}
                step={1}
                value={correctCount}
                placeholder="17"
                onChange={(event) => setCorrectCount(event.target.value)}
              />
            </label>
            <label>
              用时 min
              <input type="number" min={0} step="0.1" value={minutes} placeholder="45" onChange={(event) => setMinutes(event.target.value)} />
            </label>
            <label className="record-accuracy-preview">
              自动正确率
              <span className="record-form-preview">{computedAccuracy === null ? "--" : `${computedAccuracy}%`}</span>
            </label>
            <div className="record-issue-field">
              <span className="field-label">错因标签</span>
              <div className="issue-chip-grid">
                {issueTags.map((item) => (
                  <button
                    className={`issue-chip ${selectedIssueTags.includes(item.tag) ? "active" : ""}`}
                    key={item.tag}
                    type="button"
                    onClick={() => toggleIssueTag(item.tag)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="record-note-field">
              备注
              <textarea value={note} rows={4} placeholder="错因、状态、题型或复盘重点" onChange={(event) => setNote(event.target.value)} />
            </label>
            <button className="primary-btn record-submit" onClick={submit} disabled={saving}>
              <Plus size={18} /> {saving ? "保存中..." : "保存记录"}
            </button>
          </div>
        </section>

        <section className="panel record-table-panel">
          <div className="panel-title">
            <h2>近期记录</h2>
            <span>{records.length} 条</span>
          </div>
          {records.length ? (
            <div className="record-list">
              {records.slice(0, 12).map((record) => (
                <article className="record-row" key={record.id}>
                  <i style={{ background: categoryColor(record.category) }} />
                  <div>
                    <b>{record.label}</b>
                    <span>{record.date} · {record.question_count ? `${record.correct_count}/${record.question_count} 题` : "未记录题量"}</span>
                    {record.note && <p>{record.note}</p>}
                    {record.issue_labels.length > 0 && (
                      <div className="record-tags">
                        {record.issue_labels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <strong>{formatRecordAccuracy(record.accuracy)}</strong>
                  <span>{record.minutes}min</span>
                  <button className="icon-btn" title="删除" onClick={() => deleteRecord(record)}>
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state small">还没有做题记录。先保存一条，趋势就会开始出现。</div>
          )}
        </section>
      </div>

      <RecordInsightPanel stats={stats} />

      <div className="record-chart-grid">
        <RecordTrendChart title={scope === "week" ? "每周用时" : "每月用时"} metric="minutes" stats={stats} />
        <RecordTrendChart title={scope === "week" ? "每周正确率" : "每月正确率"} metric="accuracy" stats={stats} />
      </div>

      <section className="panel record-category-panel">
        <div className="panel-title">
          <h2>板块表现</h2>
          <span>{scope === "week" ? `${year}年${month}月` : `${year}年`}</span>
        </div>
        <div className="record-category-grid">
          {categoryRows.map((row) => (
            <div className="record-category-card" key={row.category}>
              <i style={{ background: categoryColor(row.category) }} />
              <b>{row.label}</b>
              <span>{row.record_count} 次</span>
              <span>{row.question_count} 题 · {row.correct_count} 对</span>
              <span>{row.minutes}min</span>
              {row.issue_summary?.[0] && <span>高频：{row.issue_summary[0].label}</span>}
              <strong>{formatRecordAccuracy(row.accuracy)}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function TaskRow({
  task,
  onPatch,
  toast
}: {
  task: Task;
  onPatch: (payload: TaskPatchPayload) => Promise<void>;
  toast: (message: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [questionCount, setQuestionCount] = useState(task.result_question_count === null ? "" : String(task.result_question_count));
  const [accuracy, setAccuracy] = useState(task.result_accuracy === null ? "" : String(task.result_accuracy));
  const [minutes, setMinutes] = useState(task.result_minutes === null ? "" : String(task.result_minutes));
  const [note, setNote] = useState(task.note || "");
  const [expanded, setExpanded] = useState(false);
  const receivedAt = useRef(Date.now());
  const autoDone = useRef(false);
  const isPractice = task.task_type === "practice";
  const tagLabel = categoryLabel(task.practice_tag || task.category);
  const detailId = `task-details-${task.id}`;

  useEffect(() => {
    receivedAt.current = Date.now();
    autoDone.current = false;
    setQuestionCount(task.result_question_count === null ? "" : String(task.result_question_count));
    setAccuracy(task.result_accuracy === null ? "" : String(task.result_accuracy));
    setMinutes(task.result_minutes === null ? "" : String(task.result_minutes));
    setNote(task.note || "");
  }, [task.id, task.status, task.accumulated_seconds, task.result_question_count, task.result_accuracy, task.result_minutes, task.note]);

  useEffect(() => {
    if (task.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [task.status]);

  const elapsed = task.accumulated_seconds + (task.status === "running" ? Math.max(0, Math.floor((now - receivedAt.current) / 1000)) : 0);
  const targetSeconds = (task.target_minutes || 0) * 60;
  const remaining = targetSeconds ? Math.max(0, targetSeconds - elapsed) : 0;
  const progress = targetSeconds ? Math.min(100, Math.round((elapsed / targetSeconds) * 100)) : task.status === "done" ? 100 : 0;

  useEffect(() => {
    if (task.status === "running" && targetSeconds > 0 && elapsed >= targetSeconds && !autoDone.current) {
      autoDone.current = true;
      if (isPractice) {
        toast("倒计时结束，请填写刷题结果后打勾");
        onPatch({ status: "pending" }).catch(() => undefined);
      } else {
        onPatch({ status: "done" }).catch(() => undefined);
      }
    }
  }, [elapsed, targetSeconds, task.status, isPractice, onPatch, toast]);

  const buildPracticePayload = (status?: Task["status"]): TaskPatchPayload | null => {
    const parsedCount = Number(questionCount);
    const parsedAccuracy = Number(accuracy);
    const parsedMinutes = Number(minutes);
    if (!questionCount.trim() || !Number.isFinite(parsedCount) || parsedCount <= 0) {
      toast("请填写有效刷题量");
      return null;
    }
    if (!accuracy.trim() || !Number.isFinite(parsedAccuracy) || parsedAccuracy < 0 || parsedAccuracy > 100) {
      toast("请填写 0-100 的正确率");
      return null;
    }
    if (!minutes.trim() || !Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      toast("请填写有效用时");
      return null;
    }
    return {
      status,
      note,
      result_question_count: Math.round(parsedCount),
      result_accuracy: Math.round(parsedAccuracy * 10) / 10,
      result_minutes: Math.round(parsedMinutes * 10) / 10
    };
  };

  const toggleDone = () => {
    if (task.status === "done") {
      onPatch({ status: "pending" });
      return;
    }
    if (isPractice) {
      if (!expanded) setExpanded(true);
      const payload = buildPracticePayload("done");
      if (payload) onPatch(payload);
      return;
    }
    onPatch({ status: "done", note });
  };

  const saveResult = () => {
    if (isPractice) {
      const payload = buildPracticePayload();
      if (payload) onPatch(payload);
      return;
    }
    onPatch({ note });
  };

  return (
    <article className={`task-row ${task.status} ${isPractice ? "practice" : "item"} ${expanded ? "expanded" : "collapsed"}`}>
      <button className="check-btn" type="button" title="完成" onClick={toggleDone}>
        {task.status === "done" && <Check size={18} />}
      </button>
      <button
        className="task-summary"
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="task-main">
          <b>{task.title}</b>
          <span>{isPractice ? "刷题" : "事项"}</span>
          <span>{tagLabel}</span>
          <span className="task-time">{task.planned_start || "--:--"} - {task.planned_end || "--:--"}</span>
        </span>
        <ChevronRight className="task-disclosure" size={18} />
      </button>
      <div className="task-actions">
        {task.status === "running" ? (
          <button className="icon-btn" type="button" title="暂停" onClick={() => onPatch({ status: "pending" })}>
            <Pause size={18} />
          </button>
        ) : (
          <button className="icon-btn" type="button" title="开始倒计时" onClick={() => onPatch({ status: "running" })} disabled={task.status === "done"}>
            <Play size={18} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="task-details" id={detailId}>
          <div className="task-meta detail-meta">
          <span>{task.planned_start || "--:--"} - {task.planned_end || "--:--"}</span>
          <span>已用 {formatDuration(elapsed)}</span>
          {targetSeconds > 0 && <span>剩余 {formatDuration(remaining)}</span>}
          {task.result_question_count !== null && <span>题量 {task.result_question_count}</span>}
          {task.result_accuracy !== null && <span>正确率 {task.result_accuracy}%</span>}
          {task.result_minutes !== null && <span>记录用时 {task.result_minutes}min</span>}
          </div>
          <div className="progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>
          {(isPractice || task.status === "done") && (
            <div className={`result-editor ${isPractice ? "practice-editor" : ""}`}>
              {isPractice && (
                <label>
                  题量
                  <input value={questionCount} type="number" min={1} placeholder="10" onChange={(event) => setQuestionCount(event.target.value)} />
                </label>
              )}
              {isPractice && (
                <label>
                  正确率
                  <input value={accuracy} type="number" min={0} max={100} placeholder="90" onChange={(event) => setAccuracy(event.target.value)} />
                </label>
              )}
              {isPractice && (
                <label>
                  用时 min
                  <input value={minutes} type="number" min={1} step="0.1" placeholder="27" onChange={(event) => setMinutes(event.target.value)} />
                </label>
              )}
              <label>
                复盘
                <input value={note} placeholder="一句话记录偏差与修正" onChange={(event) => setNote(event.target.value)} />
              </label>
              <button className="ghost-btn" type="button" onClick={saveResult}>
                保存
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function PlanComposer({ onCreated, toast }: { onCreated: () => void; toast: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("6 月资料分析与体能计划");
  const [objective, setObjective] = useState("资料分析每套控制在 27 分钟内，正确率达到 90%；保持晚间健身和稳定复盘。");
  const [routine, setRoutine] = useState("18:00-20:30 健身（跑步 or 健身房）- 吃饭 - 回家\n20:00-21:00 刷一套资料分析 + 复盘\n21:00-22:00 刷一套资料分析 + 复盘\n22:00-23:00 学习，睡觉\n早上 7:00-8:00 数量关系10道 + 复盘");
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const submit = async () => {
    setSaving(true);
    try {
      await api<MonthlyPlan>("/plans/monthly", {
        method: "POST",
        body: JSON.stringify({
          year,
          month,
          title,
          objective,
          target_minutes: 27,
          target_accuracy: 90,
          routine_text: routine,
          blocks: [],
          use_ai: true
        })
      });
      toast("月计划已生成每日任务");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>月计划</h2>
        <button className="icon-btn" title="新建" onClick={() => setOpen(!open)}>
          <Plus size={18} />
        </button>
      </div>
      {!open ? (
        <button className="wide-action" onClick={() => setOpen(true)}>
          <Sparkles size={18} /> 新建并自动拆分每日计划
        </button>
      ) : (
        <div className="plan-form">
          <div className="form-row">
            <label>
              年
              <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
            </label>
            <label>
              月
              <input type="number" value={month} min={1} max={12} onChange={(event) => setMonth(Number(event.target.value))} />
            </label>
          </div>
          <label>
            标题
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            目标
            <textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
          </label>
          <label>
            时间安排
            <textarea value={routine} onChange={(event) => setRoutine(event.target.value)} rows={6} />
          </label>
          <button className="primary-btn" onClick={submit} disabled={saving}>
            {saving ? "生成中..." : "生成每日任务"}
          </button>
        </div>
      )}
    </section>
  );
}

function StatsCenter() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [mode, setMode] = useState<AnalyticsMode>("tasks");
  const [recordRangePreset, setRecordRangePreset] = useState<RecordRangePreset>("this_week");
  const [customStart, setCustomStart] = useState(toDateKey(addDays(today, -29)));
  const [customEnd, setCustomEnd] = useState(toDateKey(today));
  const [recordStats, setRecordStats] = useState<PracticeRecordStats | null>(null);
  const [weekCurrentStats, setWeekCurrentStats] = useState<PracticeRecordStats | null>(null);
  const [weekPreviousStats, setWeekPreviousStats] = useState<PracticeRecordStats | null>(null);
  const [monthCurrentStats, setMonthCurrentStats] = useState<PracticeRecordStats | null>(null);
  const [monthPreviousStats, setMonthPreviousStats] = useState<PracticeRecordStats | null>(null);
  const selectedRecordRange = resolveRecordRange(recordRangePreset, customStart, customEnd, today);

  useEffect(() => {
    api<MonthlyStats>(`/stats/monthly?year=${year}&month=${month}`).then(setStats);
  }, [year, month]);

  useEffect(() => {
    const params = new URLSearchParams({
      scope: "range",
      year: String(year),
      start_date: selectedRecordRange.start,
      end_date: selectedRecordRange.end
    });
    api<PracticeRecordStats>(`/practice-records/stats?${params.toString()}`).then(setRecordStats);
  }, [selectedRecordRange.start, selectedRecordRange.end, year]);

  useEffect(() => {
    const thisWeek = resolveRecordRange("this_week", customStart, customEnd, today);
    const lastWeek = resolveRecordRange("last_week", customStart, customEnd, today);
    const thisMonth = resolveRecordRange("this_month", customStart, customEnd, today);
    const lastMonth = resolveRecordRange("last_month", customStart, customEnd, today);
    const fetchRange = (range: RecordRange) => {
      const params = new URLSearchParams({ scope: "range", year: String(year), start_date: range.start, end_date: range.end });
      return api<PracticeRecordStats>(`/practice-records/stats?${params.toString()}`);
    };
    Promise.all([fetchRange(thisWeek), fetchRange(lastWeek), fetchRange(thisMonth), fetchRange(lastMonth)])
      .then(([thisWeekStats, lastWeekStats, thisMonthStats, lastMonthStats]) => {
        setWeekCurrentStats(thisWeekStats);
        setWeekPreviousStats(lastWeekStats);
        setMonthCurrentStats(thisMonthStats);
        setMonthPreviousStats(lastMonthStats);
      })
      .catch(() => undefined);
  }, [year]);

  const daily = stats?.daily || [];
  const maxQuestions = Math.max(1, ...daily.map((day) => day.question_count || 0));
  const maxMinutes = Math.max(1, ...daily.map((day) => Number(day.practice_minutes || 0)));
  const trendGroups = [
    { tag: "data_analysis", title: "资料分析每次表现", points: stats?.practice_trends?.data_analysis || [] },
    { tag: "quantitative", title: "数量关系每次表现", points: stats?.practice_trends?.quantitative || [] }
  ];
  const tagRows = stats?.tag_summary?.length ? stats.tag_summary : practiceTags.map((tag) => ({
    tag,
    label: categoryLabel(tag),
    task_count: 0,
    question_count: 0,
    accuracy: null,
    minutes: 0
  }));
  const recordSummary = recordStats?.summary;
  const recordCategoryRows = recordStats?.category_summary || buildEmptyRecordCategories();
  const recordActiveCategories = recordCategoryRows.filter((row) => row.record_count > 0).length;
  const taskSignals = buildTaskAnalyticsSignals(stats);
  const recordSignals = buildRecordAnalyticsSignals(recordStats);

  return (
    <main className="workspace analytics-workspace">
      <div className="page-head analytics-head">
        <div>
          <p className="eyebrow">Visible progress</p>
          <h1>结果不会争辩，它只会显形。</h1>
        </div>
        <div className="date-controls">
          {mode === "tasks" && (
            <>
              <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
              <input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />
            </>
          )}
          {mode === "records" && <span className="range-summary-chip">{selectedRecordRange.start} 至 {selectedRecordRange.end}</span>}
        </div>
      </div>
      <div className="analytics-toolbar">
        <div className="segmented analytics-mode-switch">
          <button className={mode === "tasks" ? "active" : ""} onClick={() => setMode("tasks")}>任务统计</button>
          <button className={mode === "records" ? "active" : ""} onClick={() => setMode("records")}>做题记录</button>
        </div>
        {mode === "records" && (
          <div className="record-range-filter">
            <span className="record-range-label">时间范围</span>
            <select aria-label="时间范围" value={recordRangePreset} onChange={(event) => setRecordRangePreset(event.target.value as RecordRangePreset)}>
              {recordRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {recordRangePreset === "custom" && (
              <>
                <input aria-label="开始日期" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                <input aria-label="结束日期" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </>
            )}
          </div>
        )}
      </div>

      {mode === "records" ? (
        <>
          <div className="metric-grid analytics-metrics">
            <Metric icon={<FilePenLine />} label="记录次数" value={`${recordSummary?.record_count || 0}`} />
            <Metric icon={<BookOpen />} label="累计题量" value={`${recordSummary?.question_count || 0}`} />
            <Metric icon={<Gauge />} label="加权正确率" value={formatRecordAccuracy(recordSummary?.accuracy)} />
            <Metric icon={<TrendingUp />} label="7次均线" value={formatRecordAccuracy(recordSignals.movingAverage)} />
            <Metric icon={<Target />} label="达标率" value={formatRecordAccuracy(recordSignals.targetRate)} />
            <Metric icon={<Brain />} label="效率" value={`${recordSignals.efficiency ?? "-"}对/min`} />
            <Metric icon={<BarChart3 />} label="覆盖板块" value={`${recordActiveCategories}/7`} />
          </div>
          <ComparisonPanel
            weekCurrent={weekCurrentStats}
            weekPrevious={weekPreviousStats}
            monthCurrent={monthCurrentStats}
            monthPrevious={monthPreviousStats}
          />
          <TrendAlertPanel stats={recordStats} />
          <CoachReportPanel monthly={stats} records={recordStats} />
          <RecordInsightPanel stats={recordStats} />
          <div className="record-chart-grid analytics-record-charts">
            <RecordTrendChart title={`${selectedRecordRange.label}用时`} metric="minutes" stats={recordStats} />
            <RecordTrendChart title={`${selectedRecordRange.label}正确率`} metric="accuracy" stats={recordStats} />
          </div>
          <section className="panel record-category-panel analytics-record-category">
            <div className="panel-title">
              <h2>记录板块表现</h2>
              <span>{selectedRecordRange.label}</span>
            </div>
            <div className="record-category-grid">
              {recordCategoryRows.map((row) => (
                <div className="record-category-card" key={row.category}>
                  <i style={{ background: categoryColor(row.category) }} />
                  <b>{row.label}</b>
                  <span>{row.record_count} 次</span>
                  <span>{row.question_count} 题 · {row.correct_count} 对</span>
                  <span>{row.minutes}min</span>
                  {row.issue_summary?.[0] && <span>高频：{row.issue_summary[0].label}</span>}
                  <strong>{formatRecordAccuracy(row.accuracy)}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="metric-grid analytics-metrics">
            <Metric icon={<ClipboardList />} label="任务完成" value={`${stats?.tasks_done || 0}/${stats?.tasks_total || 0}`} />
            <Metric icon={<BookOpen />} label="月刷题量" value={`${stats?.question_total || 0}`} />
            <Metric icon={<BarChart3 />} label="平均正确率" value={`${stats?.avg_accuracy || 0}%`} />
            <Metric icon={<TimerReset />} label="月刷题用时" value={`${stats?.practice_minutes || 0}min`} />
            <Metric icon={<TrendingUp />} label="7日均线" value={asPercent(taskSignals.movingAverage)} />
            <Metric icon={<Target />} label="达标率" value={asPercent(taskSignals.targetRate)} />
            <Metric icon={<Brain />} label="效率" value={`${taskSignals.efficiency ?? "-"}题/min`} />
          </div>
          <CoachReportPanel monthly={stats} records={recordStats} />
          <section className="panel chart-panel">
            <div className="panel-title">
              <h2>日趋势</h2>
              <span>题量 / 正确率 / 用时</span>
            </div>
            <div className="chart-grid triple-chart">
              {daily.map((day) => (
                <div
                  className="day-bar"
                  key={day.date}
                  aria-label={`${day.date} 题量 ${day.question_count || 0}，正确率 ${day.accuracy ?? "-"}%，用时 ${day.practice_minutes || 0}min`}
                >
                  <i style={{ height: `${Math.round(((day.question_count || 0) / maxQuestions) * 100)}%` }} />
                  <em style={{ height: `${day.accuracy || 0}%` }} />
                  <b style={{ height: `${Math.round((Number(day.practice_minutes || 0) / maxMinutes) * 100)}%` }} />
                  <span>{Number(day.date.slice(-2))}</span>
                  <div className="trend-tooltip">
                    <strong>{day.date}</strong>
                    <p>题量：{day.question_count || 0} 题</p>
                    <p>正确率：{day.accuracy ?? "-"}%</p>
                    <p>用时：{day.practice_minutes || 0} min</p>
                    <p>完成率：{day.completion_rate}%</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="legend">
              <span><i className="volume" />题量</span>
              <span><i className="accuracy" />正确率</span>
              <span><i className="minutes" />用时</span>
            </div>
          </section>
          <div className="attempt-trend-grid">
            {trendGroups.map((group) => (
              <PracticeTrendChart key={group.tag} title={group.title} points={group.points} />
            ))}
          </div>
          <div className="stats-grid">
            <section className="panel table-panel">
              <div className="panel-title">
                <h2>标签统计</h2>
                <span>本月</span>
              </div>
              <div className="tag-stack">
                {tagRows.map((row) => (
                  <div className="tag-row" key={row.tag}>
                    <b>{row.label}</b>
                    <span>{row.question_count} 题</span>
                    <span>{row.accuracy === null ? "-" : `${row.accuracy}%`}</span>
                    <span>{row.minutes}min</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel table-panel">
              <div className="panel-title">
                <h2>周统计</h2>
                <span>{stats?.weekly?.length || 0} 周</span>
              </div>
              <div className="tag-stack">
                {stats?.weekly?.map((row) => (
                  <div className="tag-row" key={row.week}>
                    <b>{row.week}</b>
                    <span>{row.question_count} 题</span>
                    <span>{row.accuracy === null ? "-" : `${row.accuracy}%`}</span>
                    <span>{row.practice_minutes}min</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel table-panel">
              <div className="panel-title">
                <h2>总统计</h2>
                <span>全部历史</span>
              </div>
              <div className="total-stat">
                <Metric icon={<TrendingUp />} label="累计题量" value={`${stats?.total?.question_total || 0}`} />
                <Metric icon={<Gauge />} label="累计正确率" value={`${stats?.total?.avg_accuracy || 0}%`} />
                <Metric icon={<TimerReset />} label="累计用时" value={`${stats?.total?.practice_minutes || 0}min`} />
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function CalendarPage() {
  const initial = new Date();
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(toDateKey(initial));
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [selectedDaily, setSelectedDaily] = useState<DailyPlan | null>(null);

  useEffect(() => {
    api<MonthlyStats>(`/stats/monthly?year=${year}&month=${month}`).then(setStats);
  }, [year, month]);

  useEffect(() => {
    api<{ daily_plan: DailyPlan | null }>(`/daily?day=${selectedDate}`).then((data) => setSelectedDaily(data.daily_plan));
  }, [selectedDate]);

  const cells = buildCalendarCells(year, month);
  const statsByDate = new Map((stats?.daily || []).map((item) => [item.date, item]));
  const selectedStats = statsByDate.get(selectedDate);
  const monthTitle = `${year}年 ${month}月`;

  const moveMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDate(toDateKey(next));
  };

  const selectCell = (cell: CalendarCell) => {
    setSelectedDate(cell.dateKey);
    if (!cell.inMonth) {
      setYear(cell.date.getFullYear());
      setMonth(cell.date.getMonth() + 1);
    }
  };

  return (
    <main className="workspace calendar-workspace">
      <div className="page-head compact-head">
        <div>
          <p className="eyebrow">Calendar proof</p>
          <h1>把一个月摊开，看看哪一天真正发光。</h1>
        </div>
        <div className="calendar-nav">
          <button className="icon-btn" onClick={() => moveMonth(-1)} title="上个月">
            <ChevronLeft size={18} />
          </button>
          <b>{monthTitle}</b>
          <button className="icon-btn" onClick={() => moveMonth(1)} title="下个月">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-weekdays">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((cell) => {
              const day = statsByDate.get(cell.dateKey);
              const completion = day?.completion_rate || 0;
              const isToday = cell.dateKey === toDateKey(new Date());
              const isSelected = cell.dateKey === selectedDate;
              const hasWork = Boolean(day?.tasks_total || day?.practice_task_count);
              return (
                <button
                  key={cell.dateKey}
                  className={[
                    "calendar-cell",
                    cell.inMonth ? "" : "outside",
                    isToday ? "today" : "",
                    isSelected ? "selected" : "",
                    completion >= 100 ? "complete" : completion > 0 ? "partial" : ""
                  ].join(" ")}
                  onClick={() => selectCell(cell)}
                  title={`${cell.dateKey} 完成率 ${completion}%｜刷题 ${day?.question_count || 0} 题｜正确率 ${day?.accuracy ?? "-"}%｜用时 ${day?.practice_minutes || 0}min`}
                >
                  <span className="calendar-day">{cell.date.getDate()}</span>
                  <span className="calendar-progress" style={{ width: `${Math.max(8, completion)}%` }} />
                  <span className="calendar-dots">
                    {hasWork && <i />}
                    {(day?.practice_task_count || 0) > 0 && <i />}
                    {completion >= 100 && <i />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="panel day-detail">
          <div className="panel-title">
            <h2>{selectedDate}</h2>
            <span>{selectedDaily?.tasks_done || 0}/{selectedDaily?.tasks_total || 0}</span>
          </div>
          <div className="day-score">
            <CalendarDays size={20} />
            <b>{selectedStats?.completion_rate || 0}%</b>
            <span>完成率</span>
          </div>
          <div className="day-strip">
            <span>{selectedStats?.question_count || 0} 题</span>
            <span>{selectedStats?.accuracy ?? "-"}% 正确率</span>
            <span>{selectedStats?.practice_minutes || 0}min</span>
          </div>
          <div className="calendar-task-list">
            {selectedDaily?.tasks?.length ? (
              selectedDaily.tasks.map((task) => (
                <div className={`calendar-task ${task.status}`} key={task.id}>
                  <i />
                  <span>
                    <b>{task.title}</b>
                    <small>{task.planned_start || "--:--"} · {task.task_type === "practice" ? categoryLabel(task.practice_tag || task.category) : "事项"}</small>
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state small">这一天还没有计划。空白也可以是一种安排。</div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

type CalendarCell = {
  date: Date;
  dateKey: string;
  inMonth: boolean;
};

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      dateKey: toDateKey(date),
      inMonth: date.getMonth() === month - 1
    };
  });
}

export default App;
