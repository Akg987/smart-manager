import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE_DB, type DrizzleDatabase } from "../../database/database.token.js";
import { auditLogs, departments } from "../../../../../src/db/schema.js";

@Injectable()
export class OrganizationsService {
	constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

	static normalizeCode(code: string): string {
		const latin = code.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
		return latin.trim().toLowerCase().replace(/[ /]/g, "-").replace(/[^a-z0-9_-]/g, "");
	}

	static isValidCode(code: string): boolean { return /^[a-z][a-z0-9_-]{1,31}$/.test(code); }

	async createDepartment(input: { name: string; code: string; managerUserId?: bigint | null }, actorId: bigint) {
		const code = OrganizationsService.normalizeCode(input.code);
		if (!OrganizationsService.isValidCode(code)) throw new BadRequestException("Invalid department code.");
		return this.db.transaction(async (tx) => {
			const [department] = await tx.insert(departments).values({ ...input, code }).returning();
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "organization.department.created", subjectType: "Department", subjectId: department.id, description: "Department created", context: null, ipAddress: null, userAgent: null });
			return department;
		});
	}

	async updateDepartment(id: bigint, input: { name?: string; code?: string; managerUserId?: bigint | null }, actorId: bigint) {
		const code = input.code === undefined ? undefined : OrganizationsService.normalizeCode(input.code);
		if (code !== undefined && !OrganizationsService.isValidCode(code)) throw new BadRequestException("Invalid department code.");
		return this.db.transaction(async (tx) => {
			const [department] = await tx.update(departments).set({ ...input, ...(code === undefined ? {} : { code }), updatedAt: new Date() }).where(eq(departments.id, id)).returning();
			if (!department) throw new NotFoundException("Department not found.");
			await tx.insert(auditLogs).values({ userId: actorId, actorName: "System", action: "organization.department.updated", subjectType: "Department", subjectId: id, description: "Department updated", context: null, ipAddress: null, userAgent: null });
			return department;
		});
	}
}
