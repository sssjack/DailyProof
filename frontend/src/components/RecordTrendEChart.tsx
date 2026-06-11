import { useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { PracticeRecordStats } from "../lib/api";
import { getEChartsTheme, baseChartOption } from "../lib/chartTheme";
import { formatPeriodAxisLabel } from "../lib/dateLabels";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

type TrendMetric = "minutes" | "accuracy" | "avg_minutes";
type TrendSelection = TrendMetric | "all";
type TrendPeriod = PracticeRecordStats["periods"][number] | PracticeRecordStats["category_summary"][number]["trend"][number];

const metricItems: Array<{
  key: TrendMetric;
  overallLabel: string;
  categoryLabel: string;
  unit: string;
  color: string;
  yAxisIndex: number;
}> = [
  { key: "minutes", overallLabel: "总体用时", categoryLabel: "用时", unit: "min", color: "#2563eb", yAxisIndex: 0 },
  { key: "accuracy", overallLabel: "总体正确率", categoryLabel: "正确率", unit: "%", color: "#16a34a", yAxisIndex: 1 },
  { key: "avg_minutes", overallLabel: "平均每题用时", categoryLabel: "平均每题用时", unit: "min/题", color: "#f97316", yAxisIndex: 2 },
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
  const categoryAxis = theme.categoryAxis as { axisLabel?: object };

  const labels = useMemo(() => sourcePeriods.map((period) => formatPeriodAxisLabel(period)), [sourcePeriods]);
  const seriesMetricItems = useMemo(
    () =>
      metricItems.map((item) => ({
        ...item,
        label: activeCategory === "all" ? item.overallLabel : item.categoryLabel,
      })),
    [activeCategory]
  );
  const selectedMap = useMemo(() => {
    return Object.fromEntries(seriesMetricItems.map((item) => [item.label, selectedMetric === "all" || selectedMetric === item.key]));
  }, [selectedMetric, seriesMetricItems]);
  const subtitleText = [subtitle, activeCategory !== "all" ? selectedCategoryLabel : ""].filter(Boolean).join(" · ");

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

  const maxTotalMinutes = Math.max(30, Math.ceil(Math.max(...sourcePeriods.map((period) => Number(period.minutes || 0)), 0) / 10) * 10);
  const maxAvgMinutes = Math.max(
    1,
    Math.ceil(Math.max(...sourcePeriods.map((period) => metricValue("avg_minutes", period) || 0), 0) * 2) / 2
  );

  const option = baseChartOption({
    grid: { left: 48, right: 82, top: 52, bottom: sourcePeriods.length > 16 ? 62 : 36, containLabel: true },
    tooltip: {
      ...(theme.tooltip as object),
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = params as Array<{ dataIndex: number; seriesName: string; value: number | null; color: string }>;
        const period = sourcePeriods[items[0]?.dataIndex || 0];
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const metric = seriesMetricItems.find((candidate) => candidate.label === item.seriesName);
            return `<span style="color:${item.color}">●</span> ${item.seriesName}: ${item.value}${metric?.unit || ""}`;
          })
          .join("<br/>");
        return `<b>${formatPeriodAxisLabel(period, true)}</b><br/>${selectedCategoryLabel} · ${period.record_count} 次 · ${period.question_count} 题<br/>${rows || "暂无表现数据"}`;
      },
    },
    legend: {
      ...(theme.legend as object),
      data: seriesMetricItems.map((item) => item.label),
      selected: selectedMap,
      top: 8,
      right: 18,
    },
    xAxis: {
      ...categoryAxis,
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { ...categoryAxis.axisLabel, hideOverlap: true },
    },
    yAxis: [
      {
        ...(theme.valueAxis as object),
        type: "value",
        name: "总用时",
        min: 0,
        max: maxTotalMinutes,
        splitNumber: 4,
        axisLabel: { formatter: "{value}min" },
      },
      {
        ...(theme.valueAxis as object),
        type: "value",
        name: "正确率",
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLabel: { formatter: "{value}%" },
      },
      {
        ...(theme.valueAxis as object),
        type: "value",
        name: "每题",
        min: 0,
        max: maxAvgMinutes,
        offset: 48,
        splitLine: { show: false },
        axisLabel: { formatter: "{value}" },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      ...(sourcePeriods.length > 16 ? [{ type: "slider" as const, xAxisIndex: 0, height: 18, bottom: 8 }] : []),
    ],
    series: seriesMetricItems.map((item) => ({
      name: item.label,
      type: "line" as const,
      data: sourcePeriods.map((period) => metricValue(item.key, period)),
      yAxisIndex: item.yAxisIndex,
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      connectNulls: false,
      itemStyle: { color: item.color },
      lineStyle: { color: item.color, width: selectedMetric === item.key ? 3.4 : 2.7 },
      emphasis: { focus: "series" as const },
      markLine: item.key === "accuracy"
        ? {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed" as const, color: "#94a3b8", opacity: 0.45 },
            data: [{ yAxis: 90, label: { formatter: "目标 90%", fontSize: 11 } }],
          }
        : undefined,
    })),
  });

  return (
    <section className="panel echart-panel record-trend-panel">
      <div className="panel-title record-trend-head">
        <div>
          <h2>{title}</h2>
          {subtitleText && <span>{subtitleText}</span>}
        </div>
        {controls}
      </div>
      <div className="echart-container">
        <ReactEChartsCore echarts={echarts} option={option} theme={theme} style={{ height: 356 }} notMerge />
      </div>
    </section>
  );
}
