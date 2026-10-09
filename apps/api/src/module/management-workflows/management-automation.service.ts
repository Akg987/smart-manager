import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ManagementAutomationRepository } from "./management-automation.repository.js";

@Injectable()
export class ManagementAutomationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ManagementAutomationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly repository: ManagementAutomationRepository) {}

  onModuleInit() {
    this.timer = setInterval(
      () => {
        if (this.running) return;
        this.running = true;
        void this.repository
          .runScheduled()
          .catch((error: unknown) => {
            this.logger.error(
              "Scheduled management reminders/escalations failed.",
              error instanceof Error ? error.stack : String(error),
            );
          })
          .finally(() => {
            this.running = false;
          });
      },
      15 * 60 * 1000,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  listEscalationRules(actorId: bigint) {
    return this.repository.listEscalationRules(actorId);
  }
  createEscalationRule(
    ...args: Parameters<ManagementAutomationRepository["createEscalationRule"]>
  ) {
    return this.repository.createEscalationRule(...args);
  }
  updateEscalationRule(
    ...args: Parameters<ManagementAutomationRepository["updateEscalationRule"]>
  ) {
    return this.repository.updateEscalationRule(...args);
  }
  listReminderPolicies(actorId: bigint) {
    return this.repository.listReminderPolicies(actorId);
  }
  setReminderPolicy(
    ...args: Parameters<ManagementAutomationRepository["setReminderPolicy"]>
  ) {
    return this.repository.setReminderPolicy(...args);
  }
  run(...args: Parameters<ManagementAutomationRepository["run"]>) {
    return this.repository.run(...args);
  }
}
