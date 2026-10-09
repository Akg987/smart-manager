import { type ExecutionContext, HttpStatus } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { AppException } from "../../../../../../common/http/app.exception";
import { RoleAdmin, RoleSeller, RoleUser } from "../../users/domain/roles";
import { ADMIN_ROLES, ROLES_KEY } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";

function contextWithUser(role: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: 1, phone: "09", role } }),
    }),
  } as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows admin roles on admin-only routes", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(ADMIN_ROLES),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWithUser(RoleAdmin))).toBe(true);
  });

  it("forbids sellers on admin-only routes", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(ADMIN_ROLES),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextWithUser(RoleSeller))).toThrow(
      AppException,
    );
    try {
      guard.canActivate(contextWithUser(RoleUser));
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it("allows any authenticated user when no roles metadata is set", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextWithUser(RoleUser))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });
});
