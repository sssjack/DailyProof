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

const metricItems: Array<{ key: TrendMetric; label: string; unit: string; color: string; yAxisIndex: number }> = [
  { key: "minutes", label: "总体用时", unit: "min", color: "#2563eb", yAxisIndex: 0 },
  { key: "accuracy", label: "总体正确率", unit: "%", color: "#16a34a", yAxisIndex: 1 },
  { key: "avg_minutes", label: "平均每题用时", unit: "min/题", color: "#f97316", yAxisIndex: 2 },
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

function metricValue(metric: TrendMetric, period: PracticeRecordStats["periods"][number]) {
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
  const theme = getEChartsTheme();
  const periods = stats?.periods || [];
  const hasData = periods.some((period) => period.record_count > 0);
  const categoryAxis = theme.categoryAxis as { axisLabel?: object };

  const labels = useMemo(() => periods.map((period) => formatPeriodAxisLabel(period)), [periods]);
  const selectedMap = useMemo(() => {
    return Object.fromEntries(metricItems.map((item) => [item.label, selectedMetric === "all" || selectedMetric === item.key]));
  }, [selectedMetric]);

  if (!hasData) {
    return (
      <section className="panel echart-panel record-trend-panel">
        <div className="panel-title">
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <div className="empty-state small">暂无记录，新增做题记录后这里会显示连续趋势。</div>
      </section>
    );
  }

  const maxTotalMinutes = Math.max(30, Math.ceil(Math.max(...periods.map((period) => Number(period.minutes || 0)), 0) / 10) * 10);
  const maxAvgMinutes = Math.max(
    1,
    Math.ceil(Math.max(...periods.map((period) => metricValue("avg_minutes", period) || 0), 0) * 2) / 2
  );

  const option = baseChartOption({
    grid: { left: 48, right: 82, top: 52, bottom: periods.length > 16 ? 62 : 36, containLabel: true },
    tooltip: {
      ...theme.tooltip as object,
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = params as Array<{ dataIndex: number; seriesName: string; value: number | null; color: string }>;
        const period = periods[items[0]?.dataIndex || 0];
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const metric = metricItems.find((candidate) => candidate.label === item.seriesName);
            return `<span style="color:${item.color}">●</span> ${item.seriesName}: ${item.value}${metric?.unit || ""}`;
          })
          .join("<br/>");
        return `<b>${formatPeriodAxisLabel(period, true)}</b><br/>记录 ${period.record_count} 次 · ${period.question_count} 题<br/>${rows || "暂无表现数据"}`;
      },
    },
    legend: {
      ...theme.legend as object,
      data: metricItems.map((item) => item.label),
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
        ...theme.valueAxis as object,
        type: "value",
        name: "总用时",
        min: 0,
        max: maxTotalMinutes,
        splitNumber: 4,
        axisLabel: { formatter: "{value}min" },
      },
      {
        ...theme.valueAxis as object,
        type: "value",
        name: "正确率",
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLabel: { formatter: "{value}%" },
      },
      {
        ...theme.valueAxis as object,
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
      ...(periods.length > 16 ? [{ type: "slider" as const, xAxisIndex: 0, height: 18, bottom: 8 }] : []),
    ],
    series: metricItems.map((item) => ({
      name: item.label,
      type: "line" as const,
      data: periods.map((period) => metricValue(item.key, period)),
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
          {subtitle && <span>{subtitle}</span>}
        </div>
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
      <div className="echart-container">
        <ReactEChartsCore echarts={echarts} option={option} theme={theme} style={{ height: 356 }} notMerge />
      </div>
    </section>
  );
}
