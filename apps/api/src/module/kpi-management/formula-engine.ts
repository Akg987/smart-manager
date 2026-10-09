import { BadRequestException } from "@nestjs/common";

export type FormulaAst =
  | { type: "number"; value: number }
  | { type: "kpi"; id: string }
  | {
      type: "binary";
      operator: "+" | "-" | "*" | "/";
      left: FormulaAst;
      right: FormulaAst;
    }
  | {
      type: "call";
      function: "AVG" | "SUM" | "MIN" | "MAX" | "GROWTH" | "CHANGE" | "RATIO";
      args: FormulaAst[];
    };

export type FormulaMetric = {
  id: string;
  code: string;
  companyId: string;
  unit: string;
  periodType: string;
  status: string;
  actual: number | null;
  previousActual?: number | null;
};

const functions = new Set([
  "AVG",
  "SUM",
  "MIN",
  "MAX",
  "GROWTH",
  "CHANGE",
  "RATIO",
]);
const operators = new Set(["+", "-", "*", "/"]);

type Token = {
  kind: "number" | "identifier" | "operator" | "paren" | "comma";
  value: string;
  index: number;
};

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index++;
      continue;
    }
    const start = index;
    const char = source[index];
    if (/[0-9.]/.test(char)) {
      let value = "";
      while (index < source.length && /[0-9.]/.test(source[index]))
        value += source[index++];
      if (
        !/^(?:\d+\.?\d*|\.\d+)$/.test(value) ||
        !Number.isFinite(Number(value))
      )
        throw new BadRequestException(`Invalid number at position ${start}.`);
      tokens.push({ kind: "number", value, index: start });
      continue;
    }
    if (char === "{") {
      const close = source.indexOf("}", index + 1);
      if (close < 0)
        throw new BadRequestException(
          `Unclosed KPI reference at position ${index}.`,
        );
      const value = source.slice(index + 1, close).trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(value))
        throw new BadRequestException(
          `Invalid KPI reference at position ${index}.`,
        );
      tokens.push({ kind: "identifier", value, index });
      index = close + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let value = "";
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index]))
        value += source[index++];
      tokens.push({ kind: "identifier", value, index: start });
      continue;
    }
    if (operators.has(char)) {
      tokens.push({ kind: "operator", value: char, index });
      index++;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char, index });
      index++;
      continue;
    }
    if (char === ",") {
      tokens.push({ kind: "comma", value: char, index });
      index++;
      continue;
    }
    throw new BadRequestException(
      `Invalid formula character at position ${index}.`,
    );
  }
  return tokens;
}

export function parseFormula(
  source: string,
  kpis: readonly Pick<FormulaMetric, "id" | "code">[],
): FormulaAst {
  if (!source.trim() || source.length > 2000)
    throw new BadRequestException(
      "Formula is required and must be at most 2000 characters.",
    );
  const byCode = new Map(kpis.map((kpi) => [kpi.code.toLowerCase(), kpi.id]));
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const consume = () => tokens[cursor++];

  const primary = (): FormulaAst => {
    const token = consume();
    if (!token) throw new BadRequestException("Formula ended unexpectedly.");
    if (token.kind === "number")
      return { type: "number", value: Number(token.value) };
    if (token.kind === "operator" && token.value === "-")
      return {
        type: "binary",
        operator: "*",
        left: { type: "number", value: -1 },
        right: primary(),
      };
    if (token.kind === "paren" && token.value === "(") {
      const expression = parseExpression(0);
      const close = consume();
      if (!close || close.kind !== "paren" || close.value !== ")")
        throw new BadRequestException("Formula has an unmatched parenthesis.");
      return expression;
    }
    if (token.kind === "identifier") {
      const name = token.value.toUpperCase();
      if (peek()?.kind === "paren" && peek()?.value === "(") {
        if (!functions.has(name))
          throw new BadRequestException(
            `Unsupported formula function: ${name}.`,
          );
        consume();
        const args: FormulaAst[] = [];
        if (!(peek()?.kind === "paren" && peek()?.value === ")")) {
          do {
            args.push(parseExpression(0));
            if (peek()?.kind !== "comma") break;
            consume();
          } while (true);
        }
        const close = consume();
        if (!close || close.kind !== "paren" || close.value !== ")")
          throw new BadRequestException(
            `Function ${name} has an unmatched parenthesis.`,
          );
        if (
          !args.length ||
          (["GROWTH", "CHANGE"].includes(name) && args.length !== 1) ||
          (name === "RATIO" && args.length !== 2)
        )
          throw new BadRequestException(
            `Function ${name} has an invalid number of arguments.`,
          );
        return {
          type: "call",
          function: name as Extract<FormulaAst, { type: "call" }>["function"],
          args,
        };
      }
      const id = byCode.get(token.value.toLowerCase());
      if (!id)
        throw new BadRequestException(
          `KPI reference does not exist or is not accessible: ${token.value}.`,
        );
      return { type: "kpi", id };
    }
    throw new BadRequestException(
      `Expected a KPI code or number at position ${token.index}.`,
    );
  };

  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  function parseExpression(minPrecedence: number): FormulaAst {
    let left = primary();
    while (
      peek()?.kind === "operator" &&
      (precedence[peek()!.value] ?? -1) >= minPrecedence
    ) {
      const operator = consume().value as "+" | "-" | "*" | "/";
      const right = parseExpression(precedence[operator] + 1);
      left = { type: "binary", operator, left, right };
    }
    return left;
  }
  const ast = parseExpression(0);
  if (cursor !== tokens.length)
    throw new BadRequestException(
      `Unexpected token at position ${tokens[cursor].index}.`,
    );
  return ast;
}

export function formulaReferences(ast: FormulaAst): string[] {
  if (ast.type === "kpi") return [ast.id];
  if (ast.type === "number") return [];
  if (ast.type === "binary")
    return [...formulaReferences(ast.left), ...formulaReferences(ast.right)];
  return ast.args.flatMap(formulaReferences);
}

export function assertAcyclicFormula(
  candidateId: string,
  ast: FormulaAst,
  dependencyGraph: ReadonlyMap<string, readonly string[]>,
) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === candidateId) return true;
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of dependencyGraph.get(id) ?? [])
      if (visit(dependency)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const dependency of formulaReferences(ast)) {
    if (visit(dependency))
      throw new BadRequestException(
        "Formula creates a circular KPI dependency.",
      );
  }
}

export function validateFormula(input: {
  ast: FormulaAst;
  metrics: readonly FormulaMetric[];
  companyId: string;
  expectedUnit: string;
  expectedPeriodType: string;
  dependencyGraph?: ReadonlyMap<string, readonly string[]>;
  derivedId?: string;
}): { sourceKpis: string[]; unit: string } {
  const metrics = new Map(input.metrics.map((metric) => [metric.id, metric]));
  const references = [...new Set(formulaReferences(input.ast))];
  if (!references.length)
    throw new BadRequestException("Formula must reference at least one KPI.");
  const referenced = references.map((id) => metrics.get(id));
  if (referenced.some((metric) => !metric || metric.status !== "published"))
    throw new BadRequestException(
      "Formula references a missing or unpublished KPI.",
    );
  if (referenced.some((metric) => metric!.companyId !== input.companyId))
    throw new BadRequestException(
      "Formula KPIs must belong to the active Company.",
    );
  if (
    referenced.some((metric) => metric!.periodType !== input.expectedPeriodType)
  )
    throw new BadRequestException(
      "Formula KPIs must use compatible reporting periods.",
    );
  const inferUnit = (node: FormulaAst): string => {
    if (node.type === "number") return "1";
    if (node.type === "kpi") return metrics.get(node.id)?.unit ?? "";
    if (node.type === "binary") {
      const left = inferUnit(node.left),
        right = inferUnit(node.right);
      if (["+", "-"].includes(node.operator)) {
        if (left !== right)
          throw new BadRequestException(
            "Addition and subtraction require matching KPI units.",
          );
        return left;
      }
      if (node.operator === "/")
        return left === right ? "1" : `${left}/${right}`;
      return right === "1" ? left : left === "1" ? right : `${left}·${right}`;
    }
    const units = node.args.map(inferUnit);
    if (
      ["AVG", "SUM", "MIN", "MAX", "GROWTH", "CHANGE"].includes(node.function)
    ) {
      if (
        ["AVG", "SUM", "MIN", "MAX"].includes(node.function) &&
        new Set(units).size !== 1
      )
        throw new BadRequestException(
          `${node.function} requires matching KPI units.`,
        );
      return node.function === "GROWTH" ? "%" : units[0];
    }
    return units[0] === units[1] ? "1" : `${units[0]}/${units[1]}`;
  };
  const unit = inferUnit(input.ast);
  if (unit !== input.expectedUnit)
    throw new BadRequestException(
      `Formula result unit (${unit}) does not match the derived KPI unit (${input.expectedUnit}).`,
    );
  if (input.derivedId)
    assertAcyclicFormula(
      input.derivedId,
      input.ast,
      input.dependencyGraph ?? new Map(),
    );
  return { sourceKpis: references, unit };
}

export function evaluateFormula(
  ast: FormulaAst,
  metrics: ReadonlyMap<
    string,
    Pick<FormulaMetric, "actual" | "previousActual">
  >,
): number {
  const evaluate = (node: FormulaAst): number => {
    if (node.type === "number") return node.value;
    if (node.type === "kpi") {
      const value = metrics.get(node.id)?.actual;
      if (value === null || value === undefined || !Number.isFinite(value))
        throw new BadRequestException(
          `KPI ${node.id} has no valid actual for this period.`,
        );
      return value;
    }
    if (node.type === "binary") {
      const left = evaluate(node.left),
        right = evaluate(node.right);
      if (node.operator === "+") return left + right;
      if (node.operator === "-") return left - right;
      if (node.operator === "*") return left * right;
      if (right === 0)
        throw new BadRequestException("Formula cannot divide by zero.");
      return left / right;
    }
    const values = node.args.map(evaluate);
    if (node.function === "SUM")
      return values.reduce((sum, value) => sum + value, 0);
    if (node.function === "AVG")
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (node.function === "MIN") return Math.min(...values);
    if (node.function === "MAX") return Math.max(...values);
    if (node.function === "RATIO") {
      if (values[1] === 0)
        throw new BadRequestException("Formula cannot divide by zero.");
      return values[0] / values[1];
    }
    const previous =
      node.args.length === 1 && node.args[0].type === "kpi"
        ? metrics.get(node.args[0].id)?.previousActual
        : null;
    if (
      previous === null ||
      previous === undefined ||
      !Number.isFinite(previous)
    )
      throw new BadRequestException(
        `${node.function} requires a prior-period actual.`,
      );
    return node.function === "CHANGE"
      ? values[0] - previous
      : previous === 0
        ? (() => {
            throw new BadRequestException(
              "GROWTH cannot divide by a zero prior-period actual.",
            );
          })()
        : ((values[0] - previous) / Math.abs(previous)) * 100;
  };
  const result = evaluate(ast);
  if (!Number.isFinite(result))
    throw new BadRequestException("Formula result is not finite.");
  return result;
}
