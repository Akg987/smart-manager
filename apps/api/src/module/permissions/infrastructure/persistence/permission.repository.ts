import type {
  Permission,
  PermissionRef,
  WritePermissionInput,
} from "../../domain/permission";

export abstract class PermissionRepository {
  abstract list(): Promise<Permission[]>;
  abstract findByRefs(refs: PermissionRef[]): Promise<Permission[]>;
  abstract upsert(input: WritePermissionInput): Promise<Permission>;
}
