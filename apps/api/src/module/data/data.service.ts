import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { DataRepository, type DataCollection } from "./data.repository.js";

const jsonSafe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;

@Injectable()
export class DataService {
  constructor(
    private readonly data: DataRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(collection: DataCollection, userId: bigint) {
    const viewer = await this.data.findViewer(userId);
    if (!viewer) throw new ForbiddenException();
    const context = this.authorization.currentContext(userId);
    if (!context) throw new ForbiddenException();
    const permissions: Partial<Record<DataCollection, string>> = {
      users: "users.view",
      departments: "organization.view",
      "access-levels": "manage-roles",
      audit: "audit.view",
      modules: "modules.view",
      kpis: "kpis.view",
      checkins: "kpis.view",
      alerts: "alerts.view",
      priorities: "actions.view",
    };
    const requiredPermission = permissions[collection];
    if (
      requiredPermission &&
      !(await this.authorization.hasPermission(userId, requiredPermission))
    )
      throw new ForbiddenException("Permission denied.");
    const scopePermission =
      requiredPermission ??
      (collection === "actions" ? "actions.manage" : "actions.view");
    const departmentIds = await this.authorization.departmentsForPermission(
      userId,
      scopePermission,
    );
    const canManageActions =
      collection === "actions" &&
      (await this.authorization.hasPermission(userId, "actions.manage"));
    return jsonSafe(
      await this.data.list(
        collection,
        userId,
        context,
        departmentIds,
        canManageActions,
      ),
    );
  }
}
