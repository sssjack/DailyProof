import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gauge,
  Home,
  LogOut,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  TimerReset,
  TrendingUp,
  UserRound
} from "lucide-react";
import {
  API_BASE,
  DailyPlan,
  MonthlyPlan,
  MonthlyStats,
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

type View = "home" | "dashboard" | "stats" | "calendar";
type ThemeName = "night" | "dawn" | "pulse";
type TaskPatchPayload = Partial<
  Pick<Task, "status" | "note" | "result_question_count" | "result_accuracy" | "result_minutes">
>;

const heroUrl = `${import.meta.env.BASE_URL}hero-dailyproof.png`;
const themes: Array<{ id: ThemeName; label: string; icon: ReactNode }> = [
  { id: "night", label: "黑夜", icon: <Moon size={15} /> },
  { id: "dawn", label: "明亮", icon: <Sun size={15} /> },
  { id: "pulse", label: "脉冲", icon: <Sparkles size={15} /> }
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
      {view === "home" && <Landing onAuthed={onAuthed} />}
      {user && view === "dashboard" && <Dashboard user={user} toast={setToast} />}
      {user && view === "stats" && <StatsCenter />}
      {user && view === "calendar" && <CalendarPage />}
      {!user && view !== "home" && <Landing onAuthed={onAuthed} />}
      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
    </div>
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

function Landing({ onAuthed }: { onAuthed: (user: User) => void }) {
  return (
    <main>
      <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(3,8,10,.97) 0%, rgba(3,8,10,.88) 38%, rgba(3,8,10,.46) 70%, rgba(3,8,10,.18) 100%), url(${heroUrl})` }}>
        <div className="hero-content">
          <p className="eyebrow">Proof before promise</p>
          <h1>把每天变成证据。</h1>
          <p className="hero-copy">
            月计划自动落成每日节奏，倒计时结束自动写入状态；正确率、用时和完成率沉淀成可回看的进步曲线。
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#auth">
              进入系统 <ChevronRight size={18} />
            </a>
            <a className="ghost-link" href="#guide">
              查看用法
            </a>
          </div>
        </div>
        <AuthPanel onAuthed={onAuthed} />
      </section>

      <section id="guide" className="guide-band">
        <div className="section-head">
          <p className="eyebrow">Daily operating system</p>
          <h2>目标不是一句口号，而是一组每天可验证的数据。</h2>
        </div>
        <div className="guide-grid">
          {[
            ["定月计划", "输入目标、时段和复盘要求，系统拆成每日任务。"],
            ["两类任务", "事项一键勾选，刷题任务需要记录题量、正确率、用时和标签。"],
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

function Dashboard({ user, toast }: { user: User; toast: (message: string) => void }) {
  const [daily, setDaily] = useState<DailyPlan | null>(null);
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const refresh = async () => {
    setLoading(true);
    try {
      const [dailyData, planData, statsData] = await Promise.all([
        api<{ daily_plan: DailyPlan | null }>("/daily"),
        api<MonthlyPlan[]>(`/plans/monthly?year=${year}&month=${month}`),
        api<MonthlyStats>(`/stats/monthly?year=${year}&month=${month}`)
      ]);
      setDaily(dailyData.daily_plan);
      setPlans(planData);
      setStats(statsData);
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

  useEffect(() => {
    api<MonthlyStats>(`/stats/monthly?year=${year}&month=${month}`).then(setStats);
  }, [year, month]);

  const daily = stats?.daily || [];
  const maxQuestions = Math.max(1, ...daily.map((day) => day.question_count || 0));
  const maxMinutes = Math.max(1, ...daily.map((day) => Number(day.practice_minutes || 0)));
  const tagRows = stats?.tag_summary?.length ? stats.tag_summary : practiceTags.map((tag) => ({
    tag,
    label: categoryLabel(tag),
    task_count: 0,
    question_count: 0,
    accuracy: null,
    minutes: 0
  }));

  return (
    <main className="workspace analytics-workspace">
      <div className="page-head analytics-head">
        <div>
          <p className="eyebrow">Visible progress</p>
          <h1>结果不会争辩，它只会显形。</h1>
        </div>
        <div className="date-controls">
          <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
          <input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />
        </div>
      </div>
      <div className="metric-grid analytics-metrics">
        <Metric icon={<ClipboardList />} label="任务完成" value={`${stats?.tasks_done || 0}/${stats?.tasks_total || 0}`} />
        <Metric icon={<BookOpen />} label="月刷题量" value={`${stats?.question_total || 0}`} />
        <Metric icon={<BarChart3 />} label="平均正确率" value={`${stats?.avg_accuracy || 0}%`} />
        <Metric icon={<TimerReset />} label="月刷题用时" value={`${stats?.practice_minutes || 0}min`} />
      </div>
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
