import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CoreModule } from "./core/core.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { AiModule } from "./module/ai/ai.module.js";
import { AuthModule } from "./module/auth/runtime/auth.module.js";
import { AuthorizationModule } from "./module/authorization/authorization.module.js";
import { CorrectiveActionsModule } from "./module/corrective-actions/corrective-actions.module.js";
import { DashboardModule } from "./module/dashboard/dashboard.module.js";
import { DataModule } from "./module/data/data.module.js";
import { DecisionsModule } from "./module/decisions/decisions.module.js";
import { InboxAuditModule } from "./module/inbox-audit/inbox-audit.module.js";
import { KpiManagementModule } from "./module/kpi-management/kpi-management.module.js";
import { ManagementWorkflowsModule } from "./module/management-workflows/management-workflows.module.js";
import { ModulePlatformModule } from "./module/module-platform/module-platform.module.js";
import { OrganizationsModule } from "./module/organizations/organizations.module.js";
import { SettingsModule } from "./module/settings/settings.module.js";
import { SmsIppanelHubModule } from "./module/sms-ippanel-hub/sms-ippanel-hub.module.js";
import { TenantAdminModule } from "./module/tenant-admin/tenant-admin.module.js";
import { UsersModule } from "./module/users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env", "../../.env", "../../.env.local"],
    }),
    CoreModule,
    DatabaseModule,
    AuthModule,
    AuthorizationModule,
    UsersModule,
    OrganizationsModule,
    KpiManagementModule,
    DecisionsModule,
    CorrectiveActionsModule,
    DashboardModule,
    DataModule,
    InboxAuditModule,
    SettingsModule,
    ModulePlatformModule,
    SmsIppanelHubModule,
    TenantAdminModule,
    ManagementWorkflowsModule,
    AiModule,
  ],
})
export class AppModule {}
