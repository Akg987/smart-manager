import { Injectable } from "@nestjs/common";
import { DecisionsRepository } from "./decisions.repository.js";

@Injectable()
export class DecisionsService {
  constructor(private readonly repository: DecisionsRepository) {}
  list(actorId: bigint) {
    return this.repository.list(actorId);
  }
  create(actorId: bigint, input: Parameters<DecisionsRepository["create"]>[1]) {
    return this.repository.create(actorId, input);
  }
  approve(actorId: bigint, decisionId: bigint) {
    return this.repository.approve(actorId, decisionId);
  }
  updateOutcome(
    actorId: bigint,
    decisionId: bigint,
    input: Parameters<DecisionsRepository["updateOutcome"]>[2],
  ) {
    return this.repository.updateOutcome(actorId, decisionId, input);
  }
}
