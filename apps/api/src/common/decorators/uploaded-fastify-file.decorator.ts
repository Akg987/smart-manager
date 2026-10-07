import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AppRequest } from "../http.js";

export const UploadedFastifyFile = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    return context.switchToHttp().getRequest<AppRequest>().uploadedFile;
  },
);
