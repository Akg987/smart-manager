import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/session.service.js";
import { SessionGuard } from "../../common/session.guard.js";
import { DataService } from "./data.service.js";

@Controller("data") @UseGuards(SessionGuard)
export class DataController {
	constructor(private readonly data: DataService) {}
	@Get(":collection") list(@Req() req: AuthenticatedRequest, @Param("collection") collection: string) {
		const supported = ["users", "departments", "access-levels", "audit", "modules", "kpis", "checkins", "actions", "alerts", "inbox", "priorities"] as const;
		if (!(supported as readonly string[]).includes(collection)) return [];
		return this.data.list(collection as typeof supported[number], req.currentUser.id);
	}
}
