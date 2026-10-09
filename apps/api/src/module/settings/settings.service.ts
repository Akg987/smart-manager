import { Injectable } from "@nestjs/common";
import { SettingsRepository } from "./settings.repository.js";

@Injectable()
export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  getBranding() {
    return this.settings.getBranding();
  }

  updateBranding(companyName: string, logoPath: string | null) {
    return this.settings.updateBranding(companyName, logoPath);
  }
}
