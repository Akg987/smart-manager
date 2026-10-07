import { PROFILE_PERMISSIONS } from "../../auth/auth.permissions";
import { CART_PERMISSIONS } from "../../cart/cart.permissions";
import { INVENTORY_PERMISSIONS } from "../../inventory/inventory.permissions";
import { INVENTORY_UNIT_PERMISSIONS } from "../../inventory-units/inventory-units.permissions";
import { NIKAN_PERMISSIONS } from "../../nikan/nikan.permissions";
import { ORDER_PERMISSIONS } from "../../orders/orders.permissions";
import { PAYMENT_PERMISSIONS } from "../../payments/payments.permissions";
import {
	type PermissionRef,
	samePermission,
} from "../../permissions/domain/permission";
import { PERMISSION_CATALOG } from "../../permissions/permission-catalog";
import { EXPERT_PANEL_PERMISSIONS } from "../../sales-experts/sales-experts.permissions";
import {
	RoleAdmin,
	RoleReseller,
	RoleSalesExpert,
	RoleSeller,
	RoleSuperAdmin,
	RoleUser,
	RoleWarehouseManager,
} from "../../users/domain/roles";
import { WAREHOUSE_PERMISSIONS } from "../../warehouses/warehouses.permissions";

export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export type Role = {
	id: number;
	key: string;
	name: string;
	description: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type WriteRoleInput = {
	key: string;
	name: string;
	description?: string | null;
};

function refs(permissions: readonly PermissionRef[]): readonly PermissionRef[] {
	return permissions.map(({ module, action }) => ({ module, action }));
}

const ALL_PERMISSIONS = refs(
	PERMISSION_CATALOG.filter(
		(item) => !samePermission(item, EXPERT_PANEL_PERMISSIONS.access),
	),
);

const CUSTOMER_PERMISSIONS = refs([
	CART_PERMISSIONS.use,
	ORDER_PERMISSIONS.use,
	PAYMENT_PERMISSIONS.use,
	PROFILE_PERMISSIONS.use,
]);

export type SystemRole = {
	key: string;
	name: string;
	description: string;
	locked: boolean;
	permissions: readonly PermissionRef[];
};

export type RolePermissionGrant = PermissionRef & {
	locked: boolean;
};

export type RoleWithPermissions = Role & {
	permissions: RolePermissionGrant[];
};

function withCustomer(
	extra: readonly PermissionRef[],
): readonly PermissionRef[] {
	return [...CUSTOMER_PERMISSIONS, ...refs(extra)];
}

export function isSystemRole(key: string): boolean {
	return SYSTEM_ROLES.some((role) => role.key === key);
}

export function isLockedRole(key: string): boolean {
	return SYSTEM_ROLES.some((role) => role.key === key && role.locked);
}

export const SYSTEM_ROLES: readonly SystemRole[] = [
	{
		key: RoleSuperAdmin,
		name: "Super Admin",
		description: "Full access",
		locked: true,
		permissions: ALL_PERMISSIONS,
	},
	{
		key: RoleAdmin,
		name: "Admin",
		description: "Same permissions as super admin",
		locked: true,
		permissions: ALL_PERMISSIONS,
	},
	{
		key: RoleSeller,
		name: "Seller",
		description: "Store access, orders, and payments",
		locked: true,
		permissions: withCustomer([
			ORDER_PERMISSIONS.read,
			ORDER_PERMISSIONS.approve,
			ORDER_PERMISSIONS.cancel,
			PAYMENT_PERMISSIONS.read,
			PAYMENT_PERMISSIONS.review,
		]),
	},
	{
		key: RoleWarehouseManager,
		name: "Warehouse Manager",
		description:
			"Store access, warehouses, quantity inventory, inventory units, and Nikan sync",
		locked: true,
		permissions: withCustomer([
			...Object.values(WAREHOUSE_PERMISSIONS),
			...Object.values(INVENTORY_PERMISSIONS),
			...Object.values(INVENTORY_UNIT_PERMISSIONS),
			NIKAN_PERMISSIONS.read,
			NIKAN_PERMISSIONS.sync,
			NIKAN_PERMISSIONS.map,
		]),
	},
	{
		key: RoleSalesExpert,
		name: "Sales Expert",
		description: "Store access and the sales expert panel",
		locked: true,
		permissions: withCustomer([EXPERT_PANEL_PERMISSIONS.access]),
	},
	{
		key: RoleReseller,
		name: "Reseller",
		description: "Customer account",
		locked: false,
		permissions: CUSTOMER_PERMISSIONS,
	},
	{
		key: RoleUser,
		name: "User",
		description: "Customer account",
		locked: true,
		permissions: CUSTOMER_PERMISSIONS,
	},
];
