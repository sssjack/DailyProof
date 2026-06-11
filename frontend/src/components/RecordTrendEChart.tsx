import { useMemo, useState, type CSSProperties } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { PracticeRecordStats } from "../lib/api";
import { getEChartsTheme, baseChartOption } from "../lib/chartTheme";
import { formatPeriodAxisLabel } from "../lib/dateLabels";

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

type TrendMetric = "minutes" | "accuracy" | "avg_minutes";
type TrendSelection = TrendMetric | "all";
type TrendPeriod = PracticeRecordStats["periods"][number] | PracticeRecordStats["category_summary"][number]["trend"][number];

type TrendMetricItem = {
  key: TrendMetric;
  overallLabel: string;
  categoryLabel: string;
  unit: string;
  color: string;
  lowerIsBetter: boolean;
};

const metricItems: TrendMetricItem[] = [
  { key: "minutes", overallLabel: "总体用时", categoryLabel: "用时", unit: "min", color: "#2563eb", lowerIsBetter: true },
  { key: "accuracy", overallLabel: "总体正确率", categoryLabel: "正确率", unit: "%", color: "#16a34a", lowerIsBetter: false },
  { key: "avg_minutes", overallLabel: "平均每题用时", categoryLabel: "平均每题用时", unit: "min/题", color: "#f97316", lowerIsBetter: true },
];

const filterItems: Array<{ key: TrendSelection; label: string }> = [
  { key: "all", label: "全部" },
  { key: "minutes", label: "用时" },
  { key: "accuracy", label: "正确率" },
  { key: "avg_minutes", label: "每题耗时" },
];

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function metricValue(metric: TrendMetric, period: TrendPeriod) {
  if (!period.record_count) return null;
  if (metric === "minutes") return roundOne(Number(period.minutes || 0));
  if (metric === "accuracy") return period.accuracy === null || period.accuracy === undefined ? null : roundOne(Number(period.accuracy));
  return period.question_count > 0 ? roundTwo(Number(period.minutes || 0) / Number(period.question_count)) : null;
}

function formatMetricValue(item: TrendMetricItem & { label: string }, value: number | null) {
  if (value === null || value === undefined) return "-";
  if (item.key === "accuracy") return `${value}%`;
  if (item.key === "avg_minutes") return `${value}min/题`;
  return `${value}min`;
}

function trendColorStyle(color: string): CSSProperties {
  return { "--trend-color": color } as CSSProperties;
}

export function RecordTrendEChart({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle?: string;
  stats: PracticeRecordStats | null;
}) {
  const [selectedMetric, setSelectedMetric] = useState<TrendSelection>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const theme = getEChartsTheme();
  const overallPeriods = stats?.periods || [];
  const categoryRows = stats?.category_summary || [];
  const selectedCategoryRow =
    selectedCategory === "all" ? null : categoryRows.find((row) => row.category === selectedCategory) || null;
  const activeCategory = selectedCategoryRow ? selectedCategory : "all";
  const sourcePeriods: TrendPeriod[] = selectedCategoryRow?.trend || overallPeriods;
  const hasData = sourcePeriods.some((period) => period.record_count > 0);
  const selectedCategoryLabel = selectedCategoryRow?.label || "全部题型";
  const categoryAxis = theme.categoryAxis as { axisLabel?: object; splitLine?: object };
  const valueAxis = theme.valueAxis as { axisLabel?: object; splitLine?: object };

  const labels = useMemo(() => sourcePeriods.map((period) => formatPeriodAxisLabel(period)), [sourcePeriods]);
  const seriesMetricItems = useMemo(
    () =>
      metricItems.map((item) => ({
        ...item,
        label: activeCategory === "all" ? item.overallLabel : item.categoryLabel,
      })),
    [activeCategory]
  );
  const singleMetricItem = seriesMetricItems.find((item) => item.key === selectedMetric) || seriesMetricItems[0];
  const baseSubtitle = activeCategory === "all" ? subtitle : subtitle?.replace("总体用时 / 总体正确率 /", "用时 / 正确率 /");
  const subtitleText = [baseSubtitle, activeCategory !== "all" ? selectedCategoryLabel : ""].filter(Boolean).join(" · ");

  const metricSummary = useMemo(() => {
    return Object.fromEntries(
      seriesMetricItems.map((item) => {
        const values = sourcePeriods.map((period) => metricValue(item.key, period)).filter((value): value is number => value !== null);
        const latest = values.length ? values[values.length - 1] : null;
        const previous = values.length > 1 ? values[values.length - 2] : null;
        const delta = latest !== null && previous !== null ? roundTwo(latest - previous) : null;
        const good = delta !== null && delta !== 0 ? (item.lowerIsBetter ? delta < 0 : delta > 0) : null;
        const deltaText =
          delta === null
            ? "等待对比"
            : delta === 0
              ? "较上次持平"
              : `较上次 ${delta > 0 ? "+" : ""}${formatMetricValue(item, Math.abs(delta)).replace(/^/, delta < 0 ? "-" : "")}`;
        return [item.key, { latest, previous, delta, good, deltaText }];
      })
    ) as Record<TrendMetric, { latest: number | null; previous: number | null; delta: number | null; good: boolean | null; deltaText: string }>;
  }, [seriesMetricItems, sourcePeriods]);

  const controls = (
    <div className="record-trend-controls">
      <label className="record-category-select">
        <span>题型</span>
        <select value={activeCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="选择题型走势">
          <option value="all">全部题型</option>
          {categoryRows.map((row) => (
            <option key={row.category} value={row.category}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      <div className="record-trend-filter" aria-label="走势图指标筛选">
        {filterItems.map((item) => (
          <button
            key={item.key}
            className={selectedMetric === item.key ? "active" : ""}
            type="button"
            onClick={() => setSelectedMetric(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  const metricMax = (item: TrendMetricItem) => {
    if (item.key === "accuracy") return 100;
    const maxValue = Math.max(...sourcePeriods.map((period) => metricValue(item.key, period) || 0), 0);
    if (item.key === "avg_minutes") return Math.max(1, Math.ceil(maxValue * 2) / 2);
    return Math.max(30, Math.ceil(maxValue / 10) * 10);
  };

  const makeMetricOption = (item: TrendMetricItem & { label: string }, compact = false) => {
    const axisLabelFormatter = item.key === "accuracy" ? "{value}%" : item.key === "minutes" ? "{value}min" : "{value}";
    return baseChartOption({
      grid: compact
        ? { left: 36, right: 12, top: 14, bottom: 28, containLabel: true }
        : { left: 48, right: 26, top: 22, bottom: 40, containLabel: true },
      tooltip: {
        ...(theme.tooltip as object),
        trigger: "axis",
        formatter: (params: unknown) => {
          const first = (Array.isArray(params) ? params[0] : params) as
            | { dataIndex?: number; value?: number | null; color?: string }
            | undefined;
          const period = sourcePeriods[first?.dataIndex || 0];
          const value = period ? metricValue(item.key, period) : null;
          const rows =
            value === null
              ? "暂无表现数据"
              : `<span style="color:${first?.color || item.color}">●</span> ${item.label}: ${formatMetricValue(item, value)}`;
          return `<b>${period ? formatPeriodAxisLabel(period, true) : ""}</b><br/>${selectedCategoryLabel} · ${period?.record_count || 0} 次 · ${period?.question_count || 0} 题<br/>${rows}`;
        },
      },
      xAxis: {
        ...categoryAxis,
        type: "category",
        data: labels,
        boundaryGap: false,
        splitLine: { ...(categoryAxis.splitLine || {}), show: false },
        axisLabel: { ...categoryAxis.axisLabel, hideOverlap: true },
      },
      yAxis: {
        ...valueAxis,
        type: "value",
        name: compact ? "" : item.label,
        min: 0,
        max: metricMax(item),
        inverse: item.lowerIsBetter,
        splitNumber: compact ? 3 : 4,
        axisLabel: { ...valueAxis.axisLabel, formatter: axisLabelFormatter },
      },
      dataZoom: [{ type: "inside", xAxisIndex: 0 }],
      series: [
        {
          name: item.label,
          type: "line" as const,
          data: sourcePeriods.map((period) => metricValue(item.key, period)),
          smooth: true,
          symbol: "circle",
          symbolSize: compact ? 5 : 7,
          connectNulls: true,
          itemStyle: { color: item.color },
          lineStyle: { color: item.color, width: compact ? 2.4 : 3 },
          areaStyle: { color: item.color, opacity: compact ? 0.08 : 0.06 },
          emphasis: { focus: "series" as const },
          markLine: item.key === "accuracy"
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { type: "dashed" as const, color: "#94a3b8", opacity: compact ? 0.28 : 0.4 },
                data: [{ yAxis: 90, label: { show: !compact, formatter: "目标 90%", fontSize: 11 } }],
              }
            : undefined,
        },
      ],
    });
  };

  if (!hasData) {
    return (
      <section className="panel echart-panel record-trend-panel">
        <div className="panel-title record-trend-head">
          <div>
            <h2>{title}</h2>
            {subtitleText && <span>{subtitleText}</span>}
          </div>
          {controls}
        </div>
        <div className="empty-state small">
          {activeCategory === "all" ? "暂无记录，新增做题记录后这里会显示连续趋势。" : `${selectedCategoryLabel} 暂无记录。`}
        </div>
      </section>
    );
  }

  return (
    <section className="panel echart-panel record-trend-panel">
      <div className="panel-title record-trend-head">
        <div>
          <h2>{title}</h2>
          {subtitleText && <span>{subtitleText}</span>}
        </div>
        {controls}
      </div>
      {selectedMetric === "all" ? (
        <div className="record-trend-overview">
          {seriesMetricItems.map((item) => {
            const summary = metricSummary[item.key];
            return (
              <article className="record-trend-mini" key={item.key} style={trendColorStyle(item.color)}>
                <div className="record-trend-mini-head">
                  <span className="trend-color-line" />
                  <div>
                    <b>{item.label}</b>
                    <span className={summary.good === null ? "" : summary.good ? "good" : "bad"}>{summary.deltaText}</span>
                  </div>
                  <strong>{formatMetricValue(item, summary.latest)}</strong>
                </div>
                <ReactEChartsCore echarts={echarts} option={makeMetricOption(item, true)} theme={theme} style={{ height: 174 }} notMerge />
              </article>
            );
          })}
        </div>
      ) : (
        <div className="record-trend-focus" style={trendColorStyle(singleMetricItem.color)}>
          <div className="record-trend-focus-head">
            <span className="trend-color-line" />
            <div>
              <b>{singleMetricItem.label}</b>
              <span className={metricSummary[singleMetricItem.key].good === null ? "" : metricSummary[singleMetricItem.key].good ? "good" : "bad"}>
                {metricSummary[singleMetricItem.key].deltaText}
              </span>
            </div>
            <strong>{formatMetricValue(singleMetricItem, metricSummary[singleMetricItem.key].latest)}</strong>
          </div>
          <div className="echart-container record-trend-focus-chart">
            <ReactEChartsCore echarts={echarts} option={makeMetricOption(singleMetricItem)} theme={theme} style={{ height: 336 }} notMerge />
          </div>
        </div>
      )}
    </section>
  );
}
