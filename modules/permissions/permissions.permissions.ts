import { definePermissions } from "./domain/permission";

export const PERMISSION_PERMISSIONS = definePermissions("permissions", {
	read: "View the permission catalog",
});
