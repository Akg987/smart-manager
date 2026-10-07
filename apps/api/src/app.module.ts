import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { ModulesServicesModule } from "./modules/modules-services.module.js";
import { SessionGuard } from "./common/session.guard.js";
import { SessionService } from "./common/session.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { DashboardController } from "./modules/dashboard/dashboard.controller.js";
import { KpiController } from "./modules/kpi-management/kpi.controller.js";
import { ActionsController } from "./modules/corrective-actions/actions.controller.js";
import { UsersController } from "./modules/users/users.controller.js";
import { OrganizationsController } from "./modules/organizations/organizations.controller.js";
import { InboxController } from "./modules/inbox-audit/inbox.controller.js";
import { SettingsController } from "./modules/settings/settings.controller.js";
import { ModulePlatformController } from "./modules/module-platform/module-platform.controller.js";
import { AlertsController } from "./modules/corrective-actions/alerts.controller.js";
import { DataController } from "./modules/data/data.controller.js";
import { SmsController } from "./modules/sms-ippanel-hub/sms.controller.js";
import { CheckinsController } from "./modules/kpi-management/checkins.controller.js";
import { AuthorizationController } from "./modules/authorization/authorization.controller.js";

@Module({
	imports: [DatabaseModule, ModulesServicesModule],
	controllers: [AuthController, AuthorizationController, DashboardController, KpiController, CheckinsController, ActionsController, AlertsController, DataController, UsersController, OrganizationsController, InboxController, SettingsController, ModulePlatformController, SmsController],
	providers: [SessionService, SessionGuard],
})
export class AppModule {}
