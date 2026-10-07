import { AppException } from "../../common/http/app.exception";
import type { Permission } from "./domain/permission";
import type { PermissionRepository } from "./infrastructure/persistence/permission.repository";
import { PermissionsService } from "./permissions.service";

function permission(overrides: Partial<Permission> = {}): Permission {
	return {
		id: 1,
		module: "orders",
		action: "manage",
		description: "Manage orders",
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		...overrides,
	};
}

function serviceWith(permissions: Partial<PermissionRepository> = {}) {
	return new PermissionsService(permissions as PermissionRepository);
}

describe("PermissionsService", () => {
	it("rejects a permission that is not module and action", async () => {
		const upsert = vi.fn();
		const service = serviceWith({ upsert });

		await expect(
			service.upsert({
				module: "Orders",
				action: "manage",
				description: "bad",
			}),
		).rejects.toMatchObject({ message: "invalid permission" });
		expect(upsert).not.toHaveBeenCalled();
	});

	it("upserts a catalog permission", async () => {
		const row = permission();
		const upsert = vi.fn().mockResolvedValue(row);
		const service = serviceWith({ upsert });

		await expect(
			service.upsert({
				module: "orders",
				action: "manage",
				description: "Manage orders",
			}),
		).resolves.toBe(row);
		expect(upsert).toHaveBeenCalledWith({
			module: "orders",
			action: "manage",
			description: "Manage orders",
		});
	});

	it("uses AppException for invalid permissions", async () => {
		const service = serviceWith();
		await expect(
			service.upsert({ module: "orders", action: "" }),
		).rejects.toBeInstanceOf(AppException);
	});
});
