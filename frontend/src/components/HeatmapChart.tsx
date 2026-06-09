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
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function endOfHeatmap(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + (6 - next.getDay()));
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
}: {
  records: PracticeRecord[];
  year: number;
}) {
  const dailyMap = new Map<string, number>();
  for (const record of records) {
    dailyMap.set(record.date, (dailyMap.get(record.date) || 0) + record.question_count);
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const start = startOfHeatmap(yearStart);
  const end = endOfHeatmap(yearEnd);
  const days: Array<{ key: string; count: number; date: Date; inYear: boolean }> = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    const key = dateKey(current);
    const count = dailyMap.get(key) || 0;
    days.push({
      key,
      count,
      date: new Date(current),
      inYear: current.getFullYear() === year,
    });
  }
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const maxValue = Math.max(1, ...days.map((day) => day.count));
  const yearDays = days.filter((day) => day.inYear);
  const total = yearDays.reduce((sum, day) => sum + day.count, 0);
  const activeDays = yearDays.filter((day) => day.count > 0).length;
  const weekLabels = ["", "一", "", "三", "", "五", ""];
  const monthLabels = weeks.map((week, weekIndex) => {
    const monthStartDay = week.find((day) => day.inYear && day.date.getDate() === 1);
    if (!monthStartDay && weekIndex !== 0) return "";
    const labelDate = monthStartDay?.date || yearStart;
    return `${labelDate.getMonth() + 1}月`;
  });

  return (
    <section className="panel github-heatmap-panel">
      <div className="panel-title">
        <h2>练习热力图</h2>
        <span>{year}年 · {activeDays} 天 · {total} 题</span>
      </div>
      <div className="github-heatmap-shell" aria-label={`${year}年练习热力图`}>
        <div className="github-heatmap-corner" aria-hidden="true" />
        <div className="github-heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }} aria-hidden="true">
          {monthLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="github-heatmap-weekdays" aria-hidden="true">
          {weekLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="github-heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
          {weeks.map((week, weekIndex) => (
            <div className="github-heatmap-week" key={`week-${weekIndex}`}>
              {week.map((day) => (
                <span
                  className={`github-heatmap-cell level-${heatLevel(day.count, maxValue)} ${day.inYear ? "" : "outside"}`}
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
