import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { emptyToNull } from "../../../../../../../../../common/utils/postgres";
import type { Role, WriteRoleInput } from "../../../../domain/role";
import { roles } from "../entities/role.entity";

export type RoleEntity = InferSelectModel<typeof roles>;
export type RoleInsert = InferInsertModel<typeof roles>;

export const RoleMapper = {
  toDomain(raw: RoleEntity): Role {
    return {
      id: raw.id,
      key: raw.key,
      name: raw.name,
      description: raw.description,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  },

  toPersistence(input: WriteRoleInput): RoleInsert {
    return {
      key: input.key,
      name: input.name.trim(),
      description: emptyToNull(input.description),
    };
  },
};
