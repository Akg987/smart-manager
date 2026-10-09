import { AppException } from "../../../../../common/http/app.exception";
import type {
  Permission,
  PermissionRef,
} from "../permissions/domain/permission";
import type { PermissionsService } from "../permissions/permissions.service";
import type { Role } from "./domain/role";
import type { RoleRepository } from "./infrastructure/persistence/role.repository";
import { RolesService } from "./roles.service";

const ordersManage: PermissionRef = { module: "orders", action: "manage" };
const paymentsManage: PermissionRef = { module: "payments", action: "manage" };
const cartUse: PermissionRef = { module: "cart", action: "use" };

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 4,
    key: "seller",
    name: "Seller",
    description: "Orders and payments",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function permission(id: number, ref: PermissionRef): Permission {
  return {
    id,
    module: ref.module,
    action: ref.action,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function serviceWith(
  opts: {
    roles?: Partial<RoleRepository>;
    permissions?: Partial<PermissionsService>;
  } = {},
) {
  return new RolesService(
    opts.roles as RoleRepository,
    opts.permissions as PermissionsService,
  );
}

describe("RolesService", () => {
  it("reads permission refs for a role from the repository", async () => {
    const listPermissionRefs = vi
      .fn()
      .mockResolvedValue([ordersManage, paymentsManage]);
    const service = serviceWith({ roles: { listPermissionRefs } });

    await expect(service.permissionRefsFor("seller")).resolves.toEqual([
      ordersManage,
      paymentsManage,
    ]);
    expect(listPermissionRefs).toHaveBeenCalledWith("seller");
  });

  it("rejects an unknown role key", async () => {
    const upsert = vi.fn();
    const service = serviceWith({ roles: { upsert } });

    await expect(
      service.upsert({ key: "Seller", name: "Seller" }),
    ).rejects.toBeInstanceOf(AppException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("grants only permissions that exist", async () => {
    const grantMissing = vi.fn().mockResolvedValue(undefined);
    const findByKey = vi.fn().mockResolvedValue(role());
    const findByRefs = vi.fn().mockResolvedValue([permission(1, ordersManage)]);
    const service = serviceWith({
      roles: { findByKey, grantMissing },
      permissions: { findByRefs },
    });

    await expect(
      service.grantMissing("seller", [
        ordersManage,
        { module: "missing", action: "permission" },
      ]),
    ).rejects.toMatchObject({ message: "unknown permission" });
    expect(grantMissing).not.toHaveBeenCalled();
  });

  it("links the role to the resolved permission ids", async () => {
    const grantMissing = vi.fn().mockResolvedValue(undefined);
    const findByKey = vi.fn().mockResolvedValue(role());
    const findByRefs = vi
      .fn()
      .mockResolvedValue([
        permission(2, paymentsManage),
        permission(1, ordersManage),
      ]);
    const service = serviceWith({
      roles: { findByKey, grantMissing },
      permissions: { findByRefs },
    });

    await service.grantMissing("seller", [
      ordersManage,
      ordersManage,
      paymentsManage,
    ]);

    expect(findByRefs).toHaveBeenCalledWith([ordersManage, paymentsManage]);
    expect(grantMissing).toHaveBeenCalledWith(4, [2, 1]);
  });

  it("does not insert links when the role has an empty grant", async () => {
    const grantMissing = vi.fn();
    const findByKey = vi.fn().mockResolvedValue(role({ key: "user" }));
    const findByRefs = vi.fn();
    const service = serviceWith({
      roles: { findByKey, grantMissing },
      permissions: { findByRefs },
    });

    await service.grantMissing("user", []);

    expect(findByRefs).not.toHaveBeenCalled();
    expect(grantMissing).not.toHaveBeenCalled();
  });

  it("rejects removal of a locked permission", async () => {
    const replaceEditablePermissions = vi.fn();
    const findByKey = vi.fn().mockResolvedValue(role());
    const listGrants = vi
      .fn()
      .mockResolvedValue([{ ...cartUse, locked: true }]);
    const service = serviceWith({
      roles: { findByKey, listGrants, replaceEditablePermissions },
      permissions: { findByRefs: vi.fn().mockResolvedValue([]) },
    });

    await expect(service.setPermissions("seller", [])).rejects.toMatchObject({
      message: "system permission cannot be removed",
    });
    expect(replaceEditablePermissions).not.toHaveBeenCalled();
  });

  it("replaces editable grants and keeps locked ones", async () => {
    const replaceEditablePermissions = vi.fn().mockResolvedValue(undefined);
    const findByKey = vi.fn().mockResolvedValue(role());
    const listGrants = vi
      .fn()
      .mockResolvedValueOnce([
        { ...cartUse, locked: true },
        { ...ordersManage, locked: false },
      ])
      .mockResolvedValueOnce([
        { ...cartUse, locked: true },
        { ...paymentsManage, locked: false },
      ]);
    const findByRefs = vi
      .fn()
      .mockResolvedValue([
        permission(1, cartUse),
        permission(3, paymentsManage),
      ]);
    const service = serviceWith({
      roles: { findByKey, listGrants, replaceEditablePermissions },
      permissions: { findByRefs },
    });

    await expect(
      service.setPermissions("seller", [cartUse, paymentsManage]),
    ).resolves.toMatchObject({
      permissions: [
        { ...cartUse, locked: true },
        { ...paymentsManage, locked: false },
      ],
    });
    expect(replaceEditablePermissions).toHaveBeenCalledWith(4, [3]);
  });

  it("refuses to delete a system role", async () => {
    const deleteByKey = vi.fn();
    const service = serviceWith({ roles: { deleteByKey } });

    await expect(service.remove("admin")).rejects.toMatchObject({
      message: "system role cannot be deleted",
    });
    expect(deleteByKey).not.toHaveBeenCalled();
  });
});
