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
import { getEChartsTheme, baseChartOption, CATEGORY_COLORS } from "../lib/chartTheme";
import { formatPeriodAxisLabel } from "../lib/dateLabels";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

const recordCategories = [
  { category: "verbal", label: "言语" },
  { category: "graphic_reasoning", label: "图推" },
  { category: "quantitative", label: "数量关系" },
  { category: "data_analysis", label: "资料分析" },
  { category: "judgement_reasoning", label: "判断推理" },
  { category: "political_theory", label: "政治理论" },
  { category: "common_sense", label: "常识" },
];

function categoryColor(category: string) {
  const index = Math.max(0, recordCategories.findIndex((item) => item.category === category));
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

type RecordMetric = "minutes" | "accuracy";

export function RecordTrendEChart({
  title,
  metric,
  stats,
}: {
  title: string;
  metric: RecordMetric;
  stats: PracticeRecordStats | null;
}) {
  const theme = getEChartsTheme();
  const periods = stats?.periods || [];
  const series = stats?.category_summary || [];
  const visibleSeries = series.filter((row) => row.record_count > 0 || row.trend.some((p) => p.record_count > 0));
  const categoryAxis = theme.categoryAxis as { axisLabel?: object };

  if (!visibleSeries.length) {
    return (
      <section className="panel echart-panel">
        <div className="panel-title"><h2>{title}</h2></div>
        <div className="empty-state small">暂无记录，新增做题记录后这里会显示趋势。</div>
      </section>
    );
  }

  const labels = periods.map((p) => formatPeriodAxisLabel(p));
  const maxMinutes = Math.max(
    30,
    Math.ceil(Math.max(...series.flatMap((r) => r.trend.map((p) => Number(p.minutes || 0))), 0) / 10) * 10
  );
  const targetValue = metric === "accuracy" ? 90 : 27;
  const targetLabel = metric === "accuracy" ? "90%" : "27min";

  const option = baseChartOption({
    tooltip: {
      ...theme.tooltip as object,
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = params as Array<{ dataIndex: number; seriesName: string; value: number | null; color: string }>;
        const period = periods[items[0]?.dataIndex || 0];
        const unit = metric === "accuracy" ? "%" : "min";
        return `<b>${formatPeriodAxisLabel(period, true)}</b><br/>`
          + items.map((item) => `<span style="color:${item.color}">●</span> ${item.seriesName}: ${item.value ?? "-"}${unit}`).join("<br/>");
      },
    },
    legend: {
      ...theme.legend as object,
      data: visibleSeries.map((r) => r.label),
      top: 4,
      right: 20,
      type: "scroll",
    },
    xAxis: {
      ...categoryAxis,
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { ...categoryAxis.axisLabel, hideOverlap: true },
    },
    yAxis: {
      ...theme.valueAxis as object,
      type: "value",
      name: metric === "accuracy" ? "%" : "分钟",
      min: 0,
      max: metric === "accuracy" ? 100 : maxMinutes,
      splitNumber: 4,
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      ...(periods.length > 12 ? [{ type: "slider", xAxisIndex: 0, height: 18, bottom: 4 }] : []),
    ],
    series: [
      ...visibleSeries.map((row) => ({
        name: row.label,
        type: "line" as const,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: categoryColor(row.category) },
        data: periods.map((period) => {
          const item = row.trend.find((p) => p.period === period.period);
          if (!item || item.record_count === 0) return null;
          return metric === "accuracy" ? item.accuracy : item.minutes;
        }),
        connectNulls: false,
        markLine: row === visibleSeries[0]
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { type: "dashed" as const, color: "#94a3b8", opacity: 0.5 },
              data: [{ yAxis: targetValue, label: { formatter: `目标 ${targetLabel}`, fontSize: 11 } }],
            }
          : undefined,
      })),
    ],
  });

  return (
    <section className="panel echart-panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <span>{metric === "accuracy" ? "正确率" : "用时"}趋势</span>
      </div>
      <div className="echart-container">
        <ReactEChartsCore echarts={echarts} option={option} theme={theme} style={{ height: 300 }} notMerge />
      </div>
    </section>
  );
}
