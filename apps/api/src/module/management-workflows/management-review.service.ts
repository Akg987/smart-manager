import { Injectable } from "@nestjs/common";
import { ManagementReviewRepository } from "./management-review.repository.js";

@Injectable()
export class ManagementReviewService {
  constructor(private readonly repository: ManagementReviewRepository) {}
  list(...args: Parameters<ManagementReviewRepository["list"]>) {
    return this.repository.list(...args);
  }
  templates() {
    return this.repository.templates();
  }
  create(...args: Parameters<ManagementReviewRepository["create"]>) {
    return this.repository.create(...args);
  }
  update(...args: Parameters<ManagementReviewRepository["update"]>) {
    return this.repository.update(...args);
  }
  publish(...args: Parameters<ManagementReviewRepository["publish"]>) {
    return this.repository.publish(...args);
  }
  close(...args: Parameters<ManagementReviewRepository["close"]>) {
    return this.repository.close(...args);
  }
  export(...args: Parameters<ManagementReviewRepository["export"]>) {
    return this.repository.export(...args);
  }
}
