import { Injectable, NotFoundException } from "@nestjs/common";
import { ModulePlatformRepository } from "./module-platform.repository.js";

@Injectable()
export class ModulePlatformService {
  constructor(private readonly modules: ModulePlatformRepository) {}

  async remove(slug: string, actorId: bigint) {
    const module = await this.modules.remove(slug, actorId);
    if (!module) throw new NotFoundException("Module not found.");
    return module;
  }

  async setActive(slug: string, active: boolean, actorId: bigint) {
    const module = await this.modules.setActive(slug, active, actorId);
    if (!module) throw new NotFoundException("Module not found.");
    return module;
  }
}
