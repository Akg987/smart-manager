import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import {
  parseKpiImportColumnMapping,
  previewKpiImport,
} from "./kpi-import-parser.js";

const header = "externalId,kpiCode,period,value,unit,source";

test("previews valid CSV including zero as a real value", async () => {
  const result = await previewKpiImport(
    "kpis.csv",
    Buffer.from(`${header}\nrow-1,sales,2026-09,0,IRR,hesabro`),
  );
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].value, "0");
  assert.equal(result.issues.length, 0);
});

test("rejects duplicate external IDs and malformed periods", async () => {
  const result = await previewKpiImport(
    "kpis.csv",
    Buffer.from(
      `${header}\nrow-1,sales,2026-13,10,IRR,hesabro\nrow-1,sales,2026-09,11,IRR,hesabro`,
    ),
  );
  assert.equal(result.validRows.length, 0);
  assert.ok(result.issues.some((item) => item.field === "period"));
  assert.ok(result.issues.some((item) => item.message.includes("duplicated")));
});

test("treats source plus external ID as the idempotency key", async () => {
  const result = await previewKpiImport(
    "kpis.csv",
    Buffer.from(
      `${header}\nrow-1,sales,2026-09,10,IRR,source-a\nrow-1,margin,2026-09,11,%,source-b`,
    ),
  );
  assert.equal(result.validRows.length, 2);
  assert.equal(result.issues.length, 0);
});

test("supports explicit column mapping for localized source headers", async () => {
  const mapping = parseKpiImportColumnMapping(
    JSON.stringify({
      externalid: "شناسه",
      kpicode: "کد شاخص",
      period: "دوره",
      value: "مقدار",
      unit: "واحد",
      source: "سامانه",
    }),
  );
  const result = await previewKpiImport(
    "kpis.csv",
    Buffer.from(
      "شناسه,کد شاخص,دوره,مقدار,واحد,سامانه\nr1,sales,1405-07,12,تومان,حسابرو",
    ),
    mapping,
  );
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].source, "حسابرو");
});

test("rejects mappings that assign the same source column twice", async () => {
  const mapping = parseKpiImportColumnMapping(
    JSON.stringify({
      externalid: "one",
      kpicode: "one",
      period: "period",
      value: "value",
      unit: "unit",
      source: "source",
    }),
  );
  await assert.rejects(
    previewKpiImport(
      "kpis.csv",
      Buffer.from("one,period,value,unit,source"),
      mapping,
    ),
    /different column/,
  );
});

test("rejects unsupported formats and missing required columns", async () => {
  await assert.rejects(
    previewKpiImport("kpis.xls", Buffer.from("a,b")),
    /Only CSV and XLSX/,
  );
  await assert.rejects(
    previewKpiImport("kpis.csv", Buffer.from("kpiCode,period")),
    /Missing import column/,
  );
});

test("rejects Excel formulas instead of importing cached results", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Import");
  sheet.addRow(["externalId", "kpiCode", "period", "value", "unit", "source"]);
  sheet.addRow([
    "r1",
    "sales",
    "2026-09",
    { formula: "1+1" },
    "IRR",
    "hesabro",
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(
    previewKpiImport("kpis.xlsx", buffer),
    /Formula cells are not allowed/,
  );
});

test("rejects an empty numeric value rather than coercing it to zero", async () => {
  const result = await previewKpiImport(
    "kpis.csv",
    Buffer.from(`${header}\nr1,sales,2026-09,,IRR,hesabro`),
  );
  assert.equal(result.validRows.length, 0);
  assert.ok(result.issues.some((item) => item.field === "value"));
});
