import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, or, type SQL } from "drizzle-orm";
import { DRIZZLE } from "../../../../../../core/database/database.constants";
import type { Database } from "../../../../../../core/database/database.service";
import type {
	Permission,
	PermissionRef,
	WritePermissionInput,
} from "../../../../domain/permission";
import { PermissionRepository } from "../../permission.repository";
import { permissions } from "../entities/permission.entity";
import { PermissionMapper } from "../mappers/permission.mapper";

@Injectable()
export class PermissionsRelationalRepository implements PermissionRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Database) {}

	async list(): Promise<Permission[]> {
		const rows = await this.db
			.select()
			.from(permissions)
			.orderBy(asc(permissions.module), asc(permissions.action));
		return rows.map(PermissionMapper.toDomain);
	}

	async findByRefs(refs: PermissionRef[]): Promise<Permission[]> {
		const match = refMatch(refs);
		if (!match) {
			return [];
		}
		const rows = await this.db.select().from(permissions).where(match);
		return rows.map(PermissionMapper.toDomain);
	}

	async upsert(input: WritePermissionInput): Promise<Permission> {
		const now = new Date();
		const values = PermissionMapper.toPersistence(input);
		const [row] = await this.db
			.insert(permissions)
			.values(values)
			.onConflictDoUpdate({
				target: [permissions.module, permissions.action],
				set: { description: values.description, updatedAt: now },
			})
			.returning();
		if (!row) {
			throw new Error("failed to upsert permission");
		}
		return PermissionMapper.toDomain(row);
	}
}

function refMatch(refs: PermissionRef[]): SQL | undefined {
	if (refs.length === 0) {
		return undefined;
	}
	const clauses = refs.map((ref) =>
		and(eq(permissions.module, ref.module), eq(permissions.action, ref.action)),
	);
	return clauses.length === 1 ? clauses[0] : or(...clauses);
}
