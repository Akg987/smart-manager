import { definePermissions } from "../permissions/domain/permission";

export const ROLE_PERMISSIONS = definePermissions("roles", {
	read: "View roles",
	create: "Create roles",
	update: "Update roles",
	delete: "Delete roles",
	assignPermissions: "Change the permissions of a role",
});
