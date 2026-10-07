import { USER_PERMISSIONS } from "../admin-users/admin-users.permissions";
import { ATTRIBUTE_PERMISSIONS } from "../attributes/attributes.permissions";
import { PROFILE_PERMISSIONS } from "../auth/auth.permissions";
import { BRAND_PERMISSIONS } from "../brands/brands.permissions";
import { CART_PERMISSIONS } from "../cart/cart.permissions";
import { CATEGORY_PERMISSIONS } from "../categories/categories.permissions";
import { INVENTORY_PERMISSIONS } from "../inventory/inventory.permissions";
import { INVENTORY_UNIT_PERMISSIONS } from "../inventory-units/inventory-units.permissions";
import { NIKAN_PERMISSIONS } from "../nikan/nikan.permissions";
import { ORDER_PERMISSIONS } from "../orders/orders.permissions";
import { PAYMENT_PERMISSIONS } from "../payments/payments.permissions";
import { PRODUCT_ATTRIBUTE_PERMISSIONS } from "../product-attributes/product-attributes.permissions";
import { PRODUCT_CATEGORY_PERMISSIONS } from "../product-categories/product-categories.permissions";
import { PRODUCT_DESC_IMAGE_PERMISSIONS } from "../product-desc-images/product-desc-images.permissions";
import { PRODUCT_IMAGE_PERMISSIONS } from "../product-images/product-images.permissions";
import { PRODUCT_PERMISSIONS } from "../products/products.permissions";
import { ROLE_PERMISSIONS } from "../roles/roles.permissions";
import {
	EXPERT_PANEL_PERMISSIONS,
	SALES_EXPERT_PERMISSIONS,
} from "../sales-experts/sales-experts.permissions";
import { SETTING_PERMISSIONS } from "../settings/settings.permissions";
import { WAREHOUSE_PERMISSIONS } from "../warehouses/warehouses.permissions";
import type { PermissionDefinition } from "./domain/permission";
import { PERMISSION_PERMISSIONS } from "./permissions.permissions";

const MODULE_PERMISSIONS = [
	USER_PERMISSIONS,
	PRODUCT_PERMISSIONS,
	CATEGORY_PERMISSIONS,
	BRAND_PERMISSIONS,
	SETTING_PERMISSIONS,
	ATTRIBUTE_PERMISSIONS,
	PRODUCT_ATTRIBUTE_PERMISSIONS,
	PRODUCT_CATEGORY_PERMISSIONS,
	PRODUCT_IMAGE_PERMISSIONS,
	PRODUCT_DESC_IMAGE_PERMISSIONS,
	INVENTORY_PERMISSIONS,
	SALES_EXPERT_PERMISSIONS,
	ORDER_PERMISSIONS,
	PAYMENT_PERMISSIONS,
	WAREHOUSE_PERMISSIONS,
	INVENTORY_UNIT_PERMISSIONS,
	NIKAN_PERMISSIONS,
	EXPERT_PANEL_PERMISSIONS,
	CART_PERMISSIONS,
	PROFILE_PERMISSIONS,
	ROLE_PERMISSIONS,
	PERMISSION_PERMISSIONS,
] as const;

export const PERMISSION_CATALOG: readonly PermissionDefinition[] =
	MODULE_PERMISSIONS.flatMap((group) => Object.values(group));
