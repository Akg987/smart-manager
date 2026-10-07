const digits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export function normalizeJalaliPeriod(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const match = /^([0-9]{4})-W(0?[1-9]|[1-4][0-9]|5[0-3])$/i.exec(
    digits(value.trim()).toUpperCase(),
  );
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (year < 1300 || year > 1600 || week < 1 || week > 53) return null;
  return `${year.toString().padStart(4, "0")}-W${week.toString().padStart(2, "0")}`;
}

export function currentJalaliPeriod(at = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(at)
      .map(({ type, value }) => [type, value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const dayOfYear =
    month <= 6 ? (month - 1) * 31 + day : 186 + (month - 7) * 30 + day;
  const week = Math.min(53, Math.max(1, Math.ceil(dayOfYear / 7)));
  return `${String(year).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
}

export function shiftJalaliPeriod(
  value: string,
  offset: number,
): string | null {
  const normalized = normalizeJalaliPeriod(value);
  if (!normalized) return null;
  const [, yearPart, weekPart] = /^(\d{4})-W(\d{2})$/.exec(normalized)!;
  let year = Number(yearPart);
  let week = Number(weekPart) + Math.trunc(offset);
  while (week > 53) {
    week -= 53;
    year++;
  }
  while (week < 1) {
    week += 53;
    year--;
  }
  return year < 1300 || year > 1600
    ? null
    : `${String(year).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
}

export function jalaliPeriodSeries(period: string, count = 8): string[] {
  const normalized = normalizeJalaliPeriod(period);
  if (!normalized) return [];
  const length = Math.max(1, Math.min(24, Math.trunc(count)));
  return Array.from({ length }, (_, index) =>
    shiftJalaliPeriod(normalized, index - (length - 1)),
  ).filter((item): item is string => item !== null);
}

/** Convert the same Y/m/d Jalali input accepted by Laravel into a Gregorian DB date. */
export function jalaliDateToGregorian(value: string): string | null {
  const match = /^([0-9]{4})[/.\-]([0-9]{1,2})[/.\-]([0-9]{1,2})$/.exec(
    digits(value.trim()),
  );
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    year < 1300 ||
    year > 1600 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (month <= 6 ? 31 : month <= 11 ? 30 : 30)
  )
    return null;

  const approximateDay =
    (month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30) + day - 1;
  const start = Date.UTC(year + 621, 2, 20 + approximateDay);
  const formatter = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  for (let offset = -3; offset <= 3; offset++) {
    const candidate = new Date(start + offset * 86_400_000);
    const parts = Object.fromEntries(
      formatter
        .formatToParts(candidate)
        .map(({ type, value: part }) => [type, part]),
    );
    if (
      Number(parts.year) === year &&
      Number(parts.month) === month &&
      Number(parts.day) === day
    ) {
      return `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, "0")}-${String(candidate.getUTCDate()).padStart(2, "0")}`;
    }
  }
  return null;
}
