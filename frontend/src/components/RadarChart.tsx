import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { RadarChart as ERadarChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { PracticeRecordStats } from "../lib/api";
import { getEChartsTheme, CATEGORY_COLORS } from "../lib/chartTheme";

echarts.use([ERadarChart, TooltipComponent, LegendComponent, CanvasRenderer]);

const recordCategories = [
  { category: "verbal", label: "言语" },
  { category: "graphic_reasoning", label: "图推" },
  { category: "quantitative", label: "数量关系" },
  { category: "data_analysis", label: "资料分析" },
  { category: "judgement_reasoning", label: "判断推理" },
  { category: "political_theory", label: "政治理论" },
  { category: "common_sense", label: "常识" },
];

export function RadarChart({ stats }: { stats: PracticeRecordStats | null }) {
  const theme = getEChartsTheme();
  const categorySummary = stats?.category_summary || [];

  if (!categorySummary.some((c) => c.record_count > 0)) {
    return null;
  }

  const indicators = recordCategories.map((c) => ({
    name: c.label,
    max: 100,
  }));

  const accuracyData = recordCategories.map((c) => {
    const found = categorySummary.find((s) => s.category === c.category);
    return found?.accuracy ?? 0;
  });

  const questionData = recordCategories.map((c) => {
    const found = categorySummary.find((s) => s.category === c.category);
    return found?.question_count ?? 0;
  });
  const maxQ = Math.max(1, ...questionData);
  const normalizedQuestions = questionData.map((q) => Math.round((q / maxQ) * 100));

  const option = {
    tooltip: {
      ...theme.tooltip as object,
    },
    legend: {
      ...theme.legend as object,
      data: ["正确率", "练习量"],
      bottom: 4,
    },
    radar: {
      indicator: indicators,
      shape: "polygon" as const,
      splitNumber: 4,
      axisName: { color: (theme.textStyle as { color: string })?.color || "#e2e8f0", fontSize: 12 },
      splitLine: { lineStyle: { color: (theme.categoryAxis as { splitLine: { lineStyle: { color: string } } })?.splitLine?.lineStyle?.color || "#1e293b" } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: (theme.categoryAxis as { axisLine: { lineStyle: { color: string } } })?.axisLine?.lineStyle?.color || "#1e293b" } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            name: "正确率",
            value: accuracyData,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { color: CATEGORY_COLORS[0], width: 2 },
            areaStyle: { color: `${CATEGORY_COLORS[0]}33` },
            itemStyle: { color: CATEGORY_COLORS[0] },
          },
          {
            name: "练习量",
            value: normalizedQuestions,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { color: CATEGORY_COLORS[1], width: 2 },
            areaStyle: { color: `${CATEGORY_COLORS[1]}33` },
            itemStyle: { color: CATEGORY_COLORS[1] },
          },
        ],
      },
    ],
  };

  return (
    <section className="panel echart-panel">
      <div className="panel-title">
        <h2>分类能力雷达</h2>
        <span>7 科综合对比</span>
      </div>
      <div className="echart-container">
        <ReactEChartsCore echarts={echarts} option={option} theme={theme} style={{ height: 320 }} notMerge />
      </div>
    </section>
  );
}
