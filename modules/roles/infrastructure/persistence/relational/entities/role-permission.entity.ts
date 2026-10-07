import {
	bigint,
	boolean,
	index,
	pgTable,
	primaryKey,
	timestamp,
} from "drizzle-orm/pg-core";
import { permissions } from "../../../../../permissions/infrastructure/persistence/relational/entities/permission.entity";
import { roles } from "./role.entity";

export const rolePermissions = pgTable(
	"role_permissions",
	{
		roleId: bigint("role_id", { mode: "number" })
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		permissionId: bigint("permission_id", { mode: "number" })
			.notNull()
			.references(() => permissions.id, { onDelete: "cascade" }),
		locked: boolean("locked").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.roleId, table.permissionId] }),
		index("idx_role_permissions_permission_id").on(table.permissionId),
	],
);
