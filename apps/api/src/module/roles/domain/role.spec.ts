import { INVENTORY_PERMISSIONS } from "../../inventory/inventory.permissions";
import { INVENTORY_UNIT_PERMISSIONS } from "../../inventory-units/inventory-units.permissions";
import { NIKAN_PERMISSIONS } from "../../nikan/nikan.permissions";
import { permissionCode } from "../../permissions/domain/permission";
import { PERMISSION_CATALOG } from "../../permissions/permission-catalog";
import { EXPERT_PANEL_PERMISSIONS } from "../../sales-experts/sales-experts.permissions";
import { RoleSuperAdmin, RoleWarehouseManager } from "../../users/domain/roles";
import { WAREHOUSE_PERMISSIONS } from "../../warehouses/warehouses.permissions";
import { isLockedRole, SYSTEM_ROLES } from "./role";

function codesOf(key: string): string[] {
  const role = SYSTEM_ROLES.find((item) => item.key === key);
  return role?.permissions.map(permissionCode) ?? [];
}

describe("PERMISSION_CATALOG", () => {
  it("keeps permission codes unique", () => {
    const codes = PERMISSION_CATALOG.map(permissionCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("does not use the coarse manage action", () => {
    expect(PERMISSION_CATALOG.map((item) => item.action)).not.toContain(
      "manage",
    );
  });
});

describe("SYSTEM_ROLES", () => {
  it("grants only permissions that exist in the catalog", () => {
    const known = new Set(PERMISSION_CATALOG.map(permissionCode));
    for (const role of SYSTEM_ROLES) {
      for (const permission of role.permissions) {
        expect(known.has(permissionCode(permission))).toBe(true);
      }
    }
  });

  it("locks every system role and nothing else", () => {
    for (const role of SYSTEM_ROLES) {
      expect(isLockedRole(role.key)).toBe(true);
    }
    expect(isLockedRole("support")).toBe(false);
  });

  it("keeps role keys unique", () => {
    const keys = SYSTEM_ROLES.map((role) => role.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives the super admin everything except the expert panel", () => {
    const codes = codesOf(RoleSuperAdmin);
    expect(codes).toHaveLength(PERMISSION_CATALOG.length - 1);
    expect(codes).not.toContain(
      permissionCode(EXPERT_PANEL_PERMISSIONS.access),
    );
  });

  it("gives the warehouse manager the warehouse feature permissions", () => {
    const codes = codesOf(RoleWarehouseManager);
    expect(codes).toEqual(
      expect.arrayContaining(
        [
          ...Object.values(WAREHOUSE_PERMISSIONS),
          ...Object.values(INVENTORY_PERMISSIONS),
          ...Object.values(INVENTORY_UNIT_PERMISSIONS),
          NIKAN_PERMISSIONS.read,
          NIKAN_PERMISSIONS.sync,
          NIKAN_PERMISSIONS.map,
        ].map(permissionCode),
      ),
    );
    expect(codes).not.toContain(permissionCode(NIKAN_PERMISSIONS.readDefaults));
    expect(codes).not.toContain(
      permissionCode(NIKAN_PERMISSIONS.updateDefaults),
    );
  });
});
