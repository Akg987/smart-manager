import { Injectable } from "@nestjs/common";
import { AppException } from "../../common/http/app.exception";
import {
	PERMISSION_PART_PATTERN,
	type Permission,
	type WritePermissionInput,
} from "./domain/permission";
import { PermissionRepository } from "./infrastructure/persistence/permission.repository";

@Injectable()
export class PermissionsService {
	constructor(private readonly permissions: PermissionRepository) {}

	list(): Promise<Permission[]> {
		return this.permissions.list();
	}

	findByRefs(refs: WritePermissionInput[]): Promise<Permission[]> {
		return this.permissions.findByRefs(refs);
	}

	async upsert(input: WritePermissionInput): Promise<Permission> {
		assertPermissionRef(input);
		return this.permissions.upsert({
			module: input.module,
			action: input.action,
			description: input.description,
		});
	}
}

function assertPermissionRef(input: { module: string; action: string }): void {
	if (
		!PERMISSION_PART_PATTERN.test(input.module) ||
		!PERMISSION_PART_PATTERN.test(input.action)
	) {
		throw AppException.invalidInput("invalid permission");
	}
}
