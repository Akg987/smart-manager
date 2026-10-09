import { definePermissions } from "../permissions/domain/permission";

export const PROFILE_PERMISSIONS = definePermissions("profile", {
  use: "View and update own profile and password",
});
