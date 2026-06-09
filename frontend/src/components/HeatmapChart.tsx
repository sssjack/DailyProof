import type { PracticeRecord } from "../lib/api";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfHeatmap(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function endOfHeatmap(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() + (7 - day));
  return next;
}

function heatLevel(value: number, max: number) {
  if (value <= 0) return 0;
  if (max <= 1) return 1;
  const ratio = value / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export function HeatmapChart({
  records,
  year,
  month,
}: {
  records: PracticeRecord[];
  year: number;
  month: number;
}) {
  const dailyMap = new Map<string, number>();
  for (const record of records) {
    dailyMap.set(record.date, (dailyMap.get(record.date) || 0) + record.question_count);
  }

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const start = startOfHeatmap(monthStart);
  const end = endOfHeatmap(monthEnd);
  const days: Array<{ key: string; count: number; date: Date; inMonth: boolean }> = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    const key = dateKey(current);
    const count = dailyMap.get(key) || 0;
    days.push({
      key,
      count,
      date: new Date(current),
      inMonth: current.getMonth() === month - 1,
    });
  }
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const maxValue = Math.max(1, ...days.map((day) => day.count));
  const total = days.filter((day) => day.inMonth).reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.inMonth && day.count > 0).length;
  const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <section className="panel github-heatmap-panel">
      <div className="panel-title">
        <h2>练习热力图</h2>
        <span>{year}年{month}月 · {activeDays} 天 · {total} 题</span>
      </div>
      <div className="github-heatmap-shell" aria-label={`${year}年${month}月练习热力图`}>
        <div className="github-heatmap-weekdays" aria-hidden="true">
          {weekLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="github-heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
          {weeks.map((week, weekIndex) => (
            <div className="github-heatmap-week" key={`week-${weekIndex}`}>
              {week.map((day) => (
                <span
                  className={`github-heatmap-cell level-${heatLevel(day.count, maxValue)} ${day.inMonth ? "" : "outside"}`}
                  key={day.key}
                  title={`${day.key} · ${day.count} 题`}
                  aria-label={`${day.key}，${day.count}题`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="github-heatmap-footer">
        <span>Less</span>
        <i className="level-0" />
        <i className="level-1" />
        <i className="level-2" />
        <i className="level-3" />
        <i className="level-4" />
        <span>More</span>
      </div>
    </section>
  );
}
