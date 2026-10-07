import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
    file: (options?: unknown) => Promise<
      | {
          fieldname: string;
          filename: string;
          mimetype: string;
          toBuffer: () => Promise<Buffer>;
        }
      | undefined
    >;
  }
  interface FastifyReply {
    setCookie: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ) => FastifyReply;
    clearCookie: (
      name: string,
      options?: Record<string, unknown>,
    ) => FastifyReply;
  }
}
