import ExcelJS from "exceljs";

export const KPI_IMPORT_LIMITS = {
  maxBytes: 1_048_576,
  maxRows: 200,
  maxColumns: 32,
} as const;

export type KpiImportRow = {
  externalId: string;
  kpiCode: string;
  period: string;
  value: string;
  unit: string;
  source: string;
  rowNumber: number;
};

export type KpiImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
};

export type KpiImportPreview = {
  validRows: KpiImportRow[];
  issues: KpiImportIssue[];
  rowCount: number;
};

export type KpiImportColumnMapping = Partial<
  Record<(typeof requiredHeaders)[number], string>
>;

const requiredHeaders = [
  "externalid",
  "kpicode",
  "period",
  "value",
  "unit",
  "source",
] as const;

function parseDelimitedText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim();
  if (typeof value === "object" && "text" in value)
    return String(value.text ?? "").trim();
  return "";
}

function normalizedHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[ _-]/g, "");
}

export function parseKpiImportColumnMapping(
  value: string | undefined,
): KpiImportColumnMapping | undefined {
  if (!value?.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Column mapping must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Column mapping must be an object.");
  const mapping = parsed as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const header of requiredHeaders) {
    const sourceHeader = mapping[header];
    if (typeof sourceHeader !== "string" || sourceHeader.trim().length === 0)
      throw new Error(`Column mapping is missing ${header}.`);
    result[header] = sourceHeader.trim();
  }
  if (
    Object.keys(mapping).some(
      (key) => !(requiredHeaders as readonly string[]).includes(key),
    )
  )
    throw new Error("Column mapping contains an unsupported field.");
  return result;
}

function normalizedHeaders(
  headers: string[],
  mapping?: KpiImportColumnMapping,
): Map<string, number> {
  const normalized = headers.map((header) => normalizedHeader(header));
  const map = new Map<string, number>();
  normalized.forEach((header, index) => {
    if (map.has(header)) throw new Error(`Duplicate import column: ${header}`);
    map.set(header, index);
  });
  const resolved = new Map<string, number>();
  const claimedIndexes = new Set<number>();
  for (const header of requiredHeaders) {
    const source = normalizedHeader(mapping?.[header] ?? header);
    const index = map.get(source);
    if (index === undefined)
      throw new Error(`Missing import column: ${header}`);
    if (claimedIndexes.has(index))
      throw new Error(
        "Column mapping must use a different column for every field.",
      );
    claimedIndexes.add(index);
    resolved.set(header, index);
  }
  return resolved;
}

function validateRows(
  rows: string[][],
  mapping?: KpiImportColumnMapping,
): KpiImportPreview {
  if (rows.length === 0) throw new Error("Import file is empty.");
  if (rows.length - 1 > KPI_IMPORT_LIMITS.maxRows)
    throw new Error("Import contains too many rows.");
  if (rows[0].length > KPI_IMPORT_LIMITS.maxColumns)
    throw new Error("Import contains too many columns.");

  const headers = normalizedHeaders(rows[0], mapping);
  const issues: KpiImportIssue[] = [];
  const validRows: KpiImportRow[] = [];
  const externalIds = new Set<string>();
  const get = (row: string[], key: (typeof requiredHeaders)[number]) =>
    (row[headers.get(key) ?? -1] ?? "").trim();

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    const rowNumber = index + 1;
    if (values.length > KPI_IMPORT_LIMITS.maxColumns) {
      issues.push({ rowNumber, field: "row", message: "Too many columns." });
      continue;
    }
    const externalId = get(values, "externalid");
    const kpiCode = get(values, "kpicode").toLowerCase();
    const period = get(values, "period");
    const rawValue = get(values, "value");
    const unit = get(values, "unit");
    const source = get(values, "source");
    const rowIssues: KpiImportIssue[] = [];
    const issue = (field: string, message: string) =>
      rowIssues.push({ rowNumber, field, message });

    if (
      !externalId ||
      externalId.length > 128 ||
      [...externalId].some((character) => character.charCodeAt(0) < 32)
    )
      issue(
        "externalId",
        "External ID is required and must be at most 128 characters.",
      );
    else {
      const sourceKey = `${source.trim().toLowerCase()}\u0000${externalId}`;
      if (externalIds.has(sourceKey))
        issue("externalId", "External ID is duplicated in this file.");
      externalIds.add(sourceKey);
    }
    if (!kpiCode || !/^[a-z][a-z0-9_-]{1,63}$/i.test(kpiCode))
      issue("kpiCode", "KPI code is missing or invalid.");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
      issue("period", "Period must use YYYY-MM format.");
    const validNumericValue =
      /^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/.test(rawValue) &&
      Number.isFinite(Number(rawValue));
    if (!validNumericValue)
      issue(
        "value",
        "Value must fit the KPI numeric precision (10 integer and 4 decimal digits).",
      );
    if (!unit || unit.length > 32)
      issue("unit", "Unit is required and must be at most 32 characters.");
    if (!source || source.length > 64)
      issue("source", "Source is required and must be at most 64 characters.");

    if (rowIssues.length > 0) issues.push(...rowIssues);
    else {
      validRows.push({
        externalId,
        kpiCode,
        period,
        value: rawValue,
        unit,
        source: source.toLowerCase(),
        rowNumber,
      });
    }
  }

  return { validRows, issues, rowCount: rows.length - 1 };
}

export async function previewKpiImport(
  filename: string,
  buffer: Buffer,
  mapping?: KpiImportColumnMapping,
): Promise<KpiImportPreview> {
  if (buffer.length === 0) throw new Error("Import file is empty.");
  if (buffer.length > KPI_IMPORT_LIMITS.maxBytes)
    throw new Error("Import file exceeds the 1 MiB limit.");

  const extension = filename.toLowerCase().split(".").pop();
  let rows: string[][];
  if (extension === "csv") {
    rows = parseDelimitedText(buffer.toString("utf8"));
  } else if (extension === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets.find((item) => item.actualRowCount > 0);
    if (!sheet) throw new Error("Workbook has no data worksheet.");
    if (sheet.actualRowCount - 1 > KPI_IMPORT_LIMITS.maxRows)
      throw new Error("Import contains too many rows.");
    if (sheet.actualColumnCount > KPI_IMPORT_LIMITS.maxColumns)
      throw new Error("Import contains too many columns.");
    rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        if (cell.type === ExcelJS.ValueType.Formula)
          throw new Error("Formula cells are not allowed in import files.");
        values[columnNumber - 1] = cellText(cell.value);
      });
      rows.push(values);
    });
  } else {
    throw new Error("Only CSV and XLSX import files are supported.");
  }

  return validateRows(rows, mapping);
}
