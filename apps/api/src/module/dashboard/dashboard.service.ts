import { Injectable } from "@nestjs/common";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { DashboardRepository } from "./dashboard.repository.js";

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async snapshot(userId: bigint) {
    const viewer = await this.dashboard.findViewer(userId);
    if (!viewer?.approvedAt) return null;
    const [kpiDepartmentIds, alertDepartmentIds] = await Promise.all([
      this.authorization.departmentsForPermission(userId, "kpi.view"),
      this.authorization.departmentsForPermission(userId, "alert.view"),
    ]);
    const counts = await this.dashboard.snapshotCounts(
      userId,
      kpiDepartmentIds,
      alertDepartmentIds,
    );
    return { departmentId: viewer.departmentId, ...counts };
  }
}
