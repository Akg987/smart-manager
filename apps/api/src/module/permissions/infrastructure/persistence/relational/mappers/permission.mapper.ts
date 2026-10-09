import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { emptyToNull } from "../../../../../../../../../common/utils/postgres";
import type {
  Permission,
  WritePermissionInput,
} from "../../../../domain/permission";
import { permissions } from "../entities/permission.entity";

export type PermissionEntity = InferSelectModel<typeof permissions>;
export type PermissionInsert = InferInsertModel<typeof permissions>;

export const PermissionMapper = {
  toDomain(raw: PermissionEntity): Permission {
    return {
      id: raw.id,
      module: raw.module,
      action: raw.action,
      description: raw.description,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  },

  toPersistence(input: WritePermissionInput): PermissionInsert {
    return {
      module: input.module,
      action: input.action,
      description: emptyToNull(input.description),
    };
  },
};
