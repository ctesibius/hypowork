import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";

/**
 * Same prefix rules as production (`main.ts`): API under `/api`, LLM reflection files at `/llms/*` (Express parity).
 */
export function applyApiGlobalPrefix(app: INestApplication) {
  app.setGlobalPrefix("api", {
    exclude: [
      { path: "llms/agent-configuration.txt", method: RequestMethod.GET },
      { path: "llms/agent-icons.txt", method: RequestMethod.GET },
      { path: "llms/agent-configuration/:adapterType.txt", method: RequestMethod.GET },
    ],
  });
}
