import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { HeatmapChart as EHeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  CalendarComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { PracticeRecord } from "../lib/api";
import { getEChartsTheme } from "../lib/chartTheme";

echarts.use([EHeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CalendarComponent, CanvasRenderer]);

export function HeatmapChart({
  records,
  year,
  month,
}: {
  records: PracticeRecord[];
  year: number;
  month: number;
}) {
  const theme = getEChartsTheme();

  const dailyMap = new Map<string, number>();
  for (const r of records) {
    dailyMap.set(r.date, (dailyMap.get(r.date) || 0) + r.question_count);
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const data: Array<[string, number]> = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    data.push([dateStr, dailyMap.get(dateStr) || 0]);
  }

  const maxVal = Math.max(1, ...data.map(([, v]) => v));

  const textColor = (theme.textStyle as { color: string })?.color || "#e2e8f0";
  const borderColor = (theme.categoryAxis as { axisLine: { lineStyle: { color: string } } })?.axisLine?.lineStyle?.color || "#1e293b";

  const option = {
    tooltip: {
      ...theme.tooltip as object,
      formatter: (params: { value: [string, number] }) => {
        const [date, count] = params.value;
        return `${date}<br/>做题量: ${count} 题`;
      },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: false,
      orient: "horizontal" as const,
      left: "center",
      bottom: 0,
      inRange: { color: ["#0f172a", "#1e3a5f", "#2563eb", "#6366f1", "#a855f7"] },
      textStyle: { color: textColor, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 10,
    },
    calendar: {
      top: 36,
      left: 40,
      right: 20,
      bottom: 40,
      range: [startDate, endDate],
      cellSize: ["auto", 20],
      itemStyle: { borderWidth: 2, borderColor },
      splitLine: { lineStyle: { color: borderColor } },
      yearLabel: { show: false },
      monthLabel: { show: false },
      dayLabel: { color: textColor, fontSize: 11, firstDay: 1, nameMap: ["日", "一", "二", "三", "四", "五", "六"] },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data,
      },
    ],
  };

  return (
    <section className="panel echart-panel">
      <div className="panel-title">
        <h2>练习热力图</h2>
        <span>{year}年{month}月</span>
      </div>
      <div className="echart-container">
        <ReactEChartsCore echarts={echarts} option={option} theme={theme} style={{ height: 200 }} notMerge />
      </div>
    </section>
  );
}
