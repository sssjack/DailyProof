import type { EChartsOption } from "echarts";

export const CATEGORY_COLORS = [
  "#6366f1", "#06b6d4", "#ec4899", "#22c55e",
  "#f59e0b", "#8b5cf6", "#64748b",
] as const;

export const CATEGORY_KEYS = [
  "verbal", "graphic_reasoning", "quantitative", "data_analysis",
  "judgement_reasoning", "political_theory", "common_sense",
] as const;

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function readCSSVar(name: string): string {
  const el = document.querySelector(".app-shell") || document.documentElement;
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function getEChartsTheme(): Record<string, unknown> {
  const textColor = readCSSVar("--text-primary") || "#e2e8f0";
  const textSecondary = readCSSVar("--text-secondary") || "#94a3b8";
  const borderColor = readCSSVar("--border-color") || "#1e293b";
  const bgCard = readCSSVar("--bg-card") || "#0f172a";

  return {
    color: [...CATEGORY_COLORS],
    backgroundColor: "transparent",
    textStyle: { color: textColor, fontFamily: "inherit" },
    title: { textStyle: { color: textColor }, subtextStyle: { color: textSecondary } },
    legend: { textStyle: { color: textSecondary } },
    tooltip: {
      backgroundColor: bgCard,
      borderColor,
      textStyle: { color: textColor, fontSize: 13 },
      extraCssText: "backdrop-filter:blur(12px);border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.3)",
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { lineStyle: { color: borderColor } },
      axisLabel: { color: textSecondary },
      splitLine: { lineStyle: { color: borderColor, type: "dashed" as const } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { lineStyle: { color: borderColor } },
      axisLabel: { color: textSecondary },
      splitLine: { lineStyle: { color: borderColor, type: "dashed" as const, opacity: 0.4 } },
    },
  };
}

export function baseChartOption(overrides: EChartsOption = {}): EChartsOption {
  return {
    grid: { left: 48, right: 20, top: 40, bottom: 36, containLabel: true },
    animation: true,
    animationDuration: 400,
    ...overrides,
  };
}
