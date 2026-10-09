import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { KpiDirection, KpiHealth } from "../../../../../src/db/schema.js";
import { KpiManagementRepository } from "./kpi-management.repository.js";

@Injectable()
export class KpiManagementService {
  static health(
    actual: number | null,
    target: number,
    direction: KpiDirection,
    warning: number | null = null,
    critical: number | null = null,
  ): KpiHealth {
    if (actual === null || !Number.isFinite(actual)) return "unknown";
    if (direction === "range") {
      const warningRadius = Math.abs(warning ?? target * 0.05);
      const criticalRadius = Math.abs(critical ?? target * 0.1);
      const variance = Math.abs(actual - target);
      return variance <= warningRadius
        ? "green"
        : variance <= criticalRadius
          ? "yellow"
          : "red";
    }
    const criticalBound =
      critical ??
      warning ??
      (direction === "lower" ? target * 1.3 : target * 0.7);
    if (direction === "higher")
      return actual >= target
        ? "green"
        : actual < criticalBound
          ? "red"
          : "yellow";
    if (direction === "lower")
      return actual <= target
        ? "green"
        : actual > criticalBound
          ? "red"
          : "yellow";
    return actual >= target
      ? "green"
      : actual < criticalBound
        ? "red"
        : "yellow";
  }

  static defaultWarning(target: number, direction: KpiDirection): number {
    if (direction === "range") return Math.abs(target) * 0.05;
    return direction === "lower" ? target * 1.15 : target * 0.85;
  }
  static defaultCritical(target: number, direction: KpiDirection): number {
    if (direction === "range") return Math.abs(target) * 0.1;
    return direction === "lower" ? target * 1.3 : target * 0.7;
  }
  static normalizeCode(value: string): string {
    return value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .trim()
      .toLowerCase()
      .replace(/[ /]/g, "-")
      .replace(/[^a-z0-9_-]/g, "");
  }
  static validCode(value: string): boolean {
    return /^[a-z][a-z0-9_-]{1,63}$/.test(value);
  }
  static thresholds(
    direction: KpiDirection,
    target: number,
    warning?: number | null,
    critical?: number | null,
  ) {
    const resolvedWarning =
      warning ?? KpiManagementService.defaultWarning(target, direction);
    const resolvedCritical =
      critical ?? KpiManagementService.defaultCritical(target, direction);
    const inconsistent =
      direction === "range"
        ? resolvedWarning < 0 || resolvedCritical < resolvedWarning
        : direction === "lower"
          ? resolvedCritical < resolvedWarning
          : resolvedCritical > resolvedWarning;
    if (inconsistent)
      throw new BadRequestException(
        "Critical threshold is inconsistent with warning threshold.",
      );
    return { warning: resolvedWarning, critical: resolvedCritical };
  }

  constructor(
    @Inject(KpiManagementRepository)
    private readonly repository: KpiManagementRepository,
  ) {}

  listStudioOptions(
    ...args: Parameters<KpiManagementRepository["listStudioOptions"]>
  ) {
    return this.repository.listStudioOptions(...args);
  }

  defaultStudioSlug(
    ...args: Parameters<KpiManagementRepository["defaultStudioSlug"]>
  ) {
    return this.repository.defaultStudioSlug(...args);
  }

  addStudioOption(
    ...args: Parameters<KpiManagementRepository["addStudioOption"]>
  ) {
    return this.repository.addStudioOption(...args);
  }

  deleteStudioOption(
    ...args: Parameters<KpiManagementRepository["deleteStudioOption"]>
  ) {
    return this.repository.deleteStudioOption(...args);
  }

  renameStudioOption(
    ...args: Parameters<KpiManagementRepository["renameStudioOption"]>
  ) {
    return this.repository.renameStudioOption(...args);
  }

  createForm(...args: Parameters<KpiManagementRepository["createForm"]>) {
    return this.repository.createForm(...args);
  }

  createDefinition(
    ...args: Parameters<KpiManagementRepository["createDefinition"]>
  ) {
    return this.repository.createDefinition(...args);
  }

  updateDefinition(
    ...args: Parameters<KpiManagementRepository["updateDefinition"]>
  ) {
    return this.repository.updateDefinition(...args);
  }

  dashboardSnapshot(
    ...args: Parameters<KpiManagementRepository["dashboardSnapshot"]>
  ) {
    return this.repository.dashboardSnapshot(...args);
  }

  submitCheckin(...args: Parameters<KpiManagementRepository["submitCheckin"]>) {
    return this.repository.submitCheckin(...args);
  }

  checkinBoard(...args: Parameters<KpiManagementRepository["checkinBoard"]>) {
    return this.repository.checkinBoard(...args);
  }

  reviewCheckin(...args: Parameters<KpiManagementRepository["reviewCheckin"]>) {
    return this.repository.reviewCheckin(...args);
  }
  lockCheckin(...args: Parameters<KpiManagementRepository["lockCheckin"]>) {
    return this.repository.lockCheckin(...args);
  }
  reviewQueue(...args: Parameters<KpiManagementRepository["reviewQueue"]>) {
    return this.repository.reviewQueue(...args);
  }
  kpiHistory(...args: Parameters<KpiManagementRepository["kpiHistory"]>) {
    return this.repository.kpiHistory(...args);
  }
  kpiDetail(...args: Parameters<KpiManagementRepository["kpiDetail"]>) {
    return this.repository.kpiDetail(...args);
  }
  kpiData(...args: Parameters<KpiManagementRepository["kpiData"]>) {
    return this.repository.kpiData(...args);
  }
  createObservation(
    ...args: Parameters<KpiManagementRepository["createObservation"]>
  ) {
    return this.repository.createObservation(...args);
  }
  listObservations(
    ...args: Parameters<KpiManagementRepository["listObservations"]>
  ) {
    return this.repository.listObservations(...args);
  }
  submitDefinitionForReview(
    ...args: Parameters<KpiManagementRepository["submitDefinitionForReview"]>
  ) {
    return this.repository.submitDefinitionForReview(...args);
  }
  publishDefinition(
    ...args: Parameters<KpiManagementRepository["publishDefinition"]>
  ) {
    return this.repository.publishDefinition(...args);
  }
  redFlagBoard(...args: Parameters<KpiManagementRepository["redFlagBoard"]>) {
    return this.repository.redFlagBoard(...args);
  }
  createRedFlag(...args: Parameters<KpiManagementRepository["createRedFlag"]>) {
    return this.repository.createRedFlag(...args);
  }
  updateRedFlag(...args: Parameters<KpiManagementRepository["updateRedFlag"]>) {
    return this.repository.updateRedFlag(...args);
  }
  redFlagRuleBoard(
    ...args: Parameters<KpiManagementRepository["redFlagRuleBoard"]>
  ) {
    return this.repository.redFlagRuleBoard(...args);
  }
  createRedFlagRule(
    ...args: Parameters<KpiManagementRepository["createRedFlagRule"]>
  ) {
    return this.repository.createRedFlagRule(...args);
  }
  updateRedFlagRule(
    ...args: Parameters<KpiManagementRepository["updateRedFlagRule"]>
  ) {
    return this.repository.updateRedFlagRule(...args);
  }
  evaluateRedFlagRules(
    ...args: Parameters<KpiManagementRepository["evaluateRedFlagRules"]>
  ) {
    return this.repository.evaluateRedFlagRules(...args);
  }

  studioBoard(...args: Parameters<KpiManagementRepository["studioBoard"]>) {
    return this.repository.studioBoard(...args);
  }
}
