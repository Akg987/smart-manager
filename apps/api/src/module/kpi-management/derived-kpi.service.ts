import { Injectable } from "@nestjs/common";
import { DerivedKpiRepository } from "./derived-kpi.repository.js";

@Injectable()
export class DerivedKpiService {
  constructor(private readonly repository: DerivedKpiRepository) {}
  list(actorId: bigint) {
    return this.repository.list(actorId);
  }
  sources(actorId: bigint) {
    return this.repository.sources(actorId);
  }
  validate(
    actorId: bigint,
    input: Parameters<DerivedKpiRepository["validate"]>[1],
  ) {
    return this.repository.validate(actorId, input);
  }
  create(
    actorId: bigint,
    input: Parameters<DerivedKpiRepository["create"]>[1],
  ) {
    return this.repository.create(actorId, input);
  }
  update(
    actorId: bigint,
    id: bigint,
    input: Parameters<DerivedKpiRepository["update"]>[2],
  ) {
    return this.repository.update(actorId, id, input);
  }
  publish(actorId: bigint, id: bigint) {
    return this.repository.publish(actorId, id);
  }
  calculate(actorId: bigint, id: bigint, period: string) {
    return this.repository.calculate(actorId, id, period);
  }
  drilldown(actorId: bigint, id: bigint, period: string) {
    return this.repository.drilldown(actorId, id, period);
  }
  history(actorId: bigint, id: bigint) {
    return this.repository.history(actorId, id);
  }
  detail(actorId: bigint, id: bigint) {
    return this.repository.detail(actorId, id);
  }
}
