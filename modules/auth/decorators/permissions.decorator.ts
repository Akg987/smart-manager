import { SetMetadata } from "@nestjs/common";
import type { PermissionRef } from "../../permissions/domain/permission";

export const PERMISSIONS_KEY = "permissions";

export const Permissions = (...permissions: PermissionRef[]) =>
	SetMetadata(PERMISSIONS_KEY, permissions);
