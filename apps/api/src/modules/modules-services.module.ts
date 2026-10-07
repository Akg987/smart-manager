import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AuthService } from "./auth/auth.service.js";
import { AuthorizationService } from "./authorization/authorization.service.js";
import { CorrectiveActionsService } from "./corrective-actions/corrective-actions.service.js";
import { DashboardService } from "./dashboard/dashboard.service.js";
import { InboxAuditService } from "./inbox-audit/inbox-audit.service.js";
import { KpiManagementService } from "./kpi-management/kpi-management.service.js";
import { ModulePlatformService } from "./module-platform/module-platform.service.js";
import { OrganizationsService } from "./organizations/organizations.service.js";
import { SettingsService } from "./settings/settings.service.js";
import { SmsIppanelHubService } from "./sms-ippanel-hub/sms-ippanel-hub.service.js";
import { UsersService } from "./users/users.service.js";
import { DataService } from "./data/data.service.js";

@Module({
	imports: [DatabaseModule],
	providers: [
		AuthService,
		UsersService,
		AuthorizationService,
		OrganizationsService,
		SettingsService,
		DashboardService,
		InboxAuditService,
		ModulePlatformService,
		KpiManagementService,
		CorrectiveActionsService,
		SmsIppanelHubService,
		DataService,
	],
	exports: [
		AuthService,
		UsersService,
		AuthorizationService,
		OrganizationsService,
		SettingsService,
		DashboardService,
		InboxAuditService,
		ModulePlatformService,
		KpiManagementService,
		CorrectiveActionsService,
		SmsIppanelHubService,
		DataService,
	],
})
export class ModulesServicesModule {}
