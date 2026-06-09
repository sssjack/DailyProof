type PeriodLike = {
  label?: string;
  start?: string | null;
  end?: string | null;
};

function parseDateKey(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

export function formatDateAxisLabel(value: string | null | undefined, withYear = false) {
  const parsed = parseDateKey(value);
  if (!parsed) return value || "";
  return withYear ? `${parsed.year}/${parsed.month}/${parsed.day}` : `${parsed.month}/${parsed.day}`;
}

export function formatDateRangeAxisLabel(start: string | null | undefined, end: string | null | undefined, withYear = false) {
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  if (!startDate && !endDate) return "";
  if (!startDate) return formatDateAxisLabel(end, withYear);
  if (!endDate || start === end) return formatDateAxisLabel(start, withYear);
  if (withYear || startDate.year !== endDate.year) {
    return `${formatDateAxisLabel(start, true)}-${formatDateAxisLabel(end, true)}`;
  }
  return `${formatDateAxisLabel(start)}-${formatDateAxisLabel(end)}`;
}

export function formatPeriodAxisLabel(period: PeriodLike, withYear = false) {
  return formatDateRangeAxisLabel(period.start, period.end, withYear) || period.label || "";
}
