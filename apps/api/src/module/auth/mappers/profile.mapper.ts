import type { PermissionRef } from "../../permissions/domain/permission";
import type { User } from "../../users/domain/user";
import type { Profile } from "../auth.types";

type ProfileText = Pick<
  Profile,
  "first_name" | "last_name" | "email" | "province" | "city" | "address"
>;
function presentText(
  fields: {
    [K in keyof ProfileText]: string | null;
  },
): ProfileText {
  const out: ProfileText = {};
  for (const key of Object.keys(fields) as (keyof ProfileText)[]) {
    const value = fields[key];
    if (value) {
      out[key] = value;
    }
  }
  return out;
}
export const ProfileMapper = {
  toResponse(user: User, permissions: readonly PermissionRef[]): Profile {
    return {
      phone: user.phone,
      role: user.role,
      permissions: permissions.map((permission) => ({
        module: permission.module,
        action: permission.action,
      })),
      ...presentText({
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        province: user.province,
        city: user.city,
        address: user.address,
      }),
    };
  },
};
