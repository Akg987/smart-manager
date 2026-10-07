import { type ExecutionContext, HttpStatus } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { AppException } from "../../../common/http/app.exception";
import type { PermissionRef } from "../../permissions/domain/permission";
import type { RoleRepository } from "../../roles/infrastructure/persistence/role.repository";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { PermissionsGuard } from "./permissions.guard";

const ordersManage: PermissionRef = { module: "orders", action: "manage" };
const productsManage: PermissionRef = { module: "products", action: "manage" };
const cartUse: PermissionRef = { module: "cart", action: "use" };

function contextWithUser(role: string): ExecutionContext {
	return {
		getHandler: () => ({}),
		getClass: () => ({}),
		switchToHttp: () => ({
			getRequest: () => ({ user: { userId: 1, phone: "09", role } }),
		}),
	} as ExecutionContext;
}

function guardWith(
	required: PermissionRef[] | undefined,
	granted: PermissionRef[],
): PermissionsGuard {
	const reflector = {
		getAllAndOverride: vi.fn().mockReturnValue(required),
	} as unknown as Reflector;
	const roles = {
		listPermissionRefs: vi.fn().mockResolvedValue(granted),
	} as unknown as RoleRepository;
	return new PermissionsGuard(reflector, roles);
}

describe("PermissionsGuard", () => {
	it("allows a role that has the required permission", async () => {
		const guard = guardWith([ordersManage], [ordersManage, cartUse]);
		await expect(guard.canActivate(contextWithUser("seller"))).resolves.toBe(
			true,
		);
	});

	it("forbids a role that lacks the required permission", async () => {
		const guard = guardWith([productsManage], [ordersManage]);
		await expect(
			guard.canActivate(contextWithUser("seller")),
		).rejects.toBeInstanceOf(AppException);
		try {
			await guard.canActivate(contextWithUser("seller"));
		} catch (error) {
			expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
		}
	});

	it("allows any request when no permission metadata is set", async () => {
		const reflector = {
			getAllAndOverride: vi.fn().mockReturnValue(undefined),
		} as unknown as Reflector;
		const roles = {
			listPermissionRefs: vi.fn(),
		} as unknown as RoleRepository;
		const guard = new PermissionsGuard(reflector, roles);

		await expect(guard.canActivate(contextWithUser("user"))).resolves.toBe(
			true,
		);
		expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
			expect.anything(),
			expect.anything(),
		]);
		expect(roles.listPermissionRefs).not.toHaveBeenCalled();
	});
});
