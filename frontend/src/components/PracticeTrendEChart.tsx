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
import type { PracticeTrendPoint } from "../lib/api";
import { getEChartsTheme, baseChartOption } from "../lib/chartTheme";
import { formatDateAxisLabel } from "../lib/dateLabels";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

export function PracticeTrendEChart({
  title,
  points,
}: {
  title: string;
  points: PracticeTrendPoint[];
}) {
  const theme = getEChartsTheme();

  if (!points.length) {
    return (
      <section className="panel echart-panel">
        <div className="panel-title"><h2>{title}</h2></div>
        <div className="empty-state small">{title}暂无完成记录，完成刷题任务后会显示每次趋势。</div>
      </section>
    );
  }

  const targetMinutes = points.find((p) => p.target_minutes)?.target_minutes || null;
  const labels = points.map((p) => formatDateAxisLabel(p.date));
  const minutesData = points.map((p) => p.minutes);
  const accuracyData = points.map((p) => p.accuracy);
  const categoryAxis = theme.categoryAxis as { axisLabel?: object };

  const option = baseChartOption({
    tooltip: {
      ...theme.tooltip as object,
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = params as Array<{ dataIndex: number; seriesName: string; value: number | null; color: string }>;
        const p = points[items[0].dataIndex];
        return `<b>${formatDateAxisLabel(p.date, true)} 第 ${p.sequence} 次</b><br/>`
          + items.map((i) => `<span style="color:${i.color}">●</span> ${i.seriesName}: ${i.value ?? "-"}${i.seriesName === "用时" ? "min" : "%"}`).join("<br/>");
      },
    },
    legend: { ...theme.legend as object, data: ["用时", "正确率"], top: 4, right: 20 },
    xAxis: {
      ...categoryAxis,
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { ...categoryAxis.axisLabel, hideOverlap: true },
    },
    yAxis: [
      { ...theme.valueAxis as object, type: "value", name: "分钟", min: 0, splitNumber: 4 },
      { ...theme.valueAxis as object, type: "value", name: "%", min: 0, max: 100, splitNumber: 4 },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      ...(points.length > 15 ? [{ type: "slider", xAxisIndex: 0, height: 18, bottom: 4 }] : []),
    ],
    series: [
      {
        name: "用时",
        type: "line",
        data: minutesData,
        yAxisIndex: 0,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        itemStyle: { color: "#06b6d4" },
        markLine: targetMinutes
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { type: "dashed", color: "#06b6d4", opacity: 0.5 },
              data: [{ yAxis: targetMinutes, label: { formatter: `${targetMinutes}min`, fontSize: 11 } }],
            }
          : undefined,
      },
      {
        name: "正确率",
        type: "line",
        data: accuracyData,
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        itemStyle: { color: "#ec4899" },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", color: "#ec4899", opacity: 0.5 },
          data: [{ yAxis: 90, label: { formatter: "90%", fontSize: 11 } }],
        },
      },
    ],
  });

  const recentPoints = points.slice(-4);

  return (
    <section className="panel echart-panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <span>{points.length} 次记录</span>
      </div>
      <div className="echart-container">
        <ReactEChartsCore echarts={echarts} option={option} theme={theme} style={{ height: 280 }} notMerge />
      </div>
      <div className="attempt-mini-list">
        {recentPoints.map((point) => (
          <div className="attempt-mini-row" key={point.id}>
            <b>#{point.sequence}</b>
            <span>{formatDateAxisLabel(point.date)}</span>
            <span>{point.minutes}min</span>
            <span>{point.accuracy ?? "-"}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
