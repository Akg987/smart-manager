import { serverApi } from "@/lib/api-server";
import {
  DepartmentsDirectory,
  UsersDirectory,
  type DirectoryDepartment,
  type DirectoryLevel,
  type DirectoryUser,
} from "./organization-client";
import type { RoutePage } from "./route-catalog";

function rows<T>(value: T[] | null) {
  return Array.isArray(value) ? value : [];
}

export async function OrganizationBoard({ page }: { page: RoutePage }) {
  if (page.directory === "departments") {
    const [departments, users] = await Promise.all([
      serverApi<DirectoryDepartment[]>("data/departments"),
      serverApi<DirectoryUser[]>("data/users"),
    ]);
    return (
      <DepartmentsDirectory
        departments={rows(departments.data)}
        users={rows(users.data)}
        error={departments.error}
      />
    );
  }
  const [users, departments, levels] = await Promise.all([
    serverApi<DirectoryUser[]>("data/users"),
    serverApi<DirectoryDepartment[]>("data/departments"),
    serverApi<DirectoryLevel[]>("data/access-levels"),
  ]);
  return (
    <UsersDirectory
      users={rows(users.data)}
      departments={rows(departments.data)}
      levels={rows(levels.data)}
      error={users.error}
    />
  );
}
