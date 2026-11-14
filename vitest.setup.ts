import { beforeEach } from "vitest";
import { __resetRpcStateForTests } from "./apps/web/lib/server/v3/rpc";

beforeEach(() => {
  __resetRpcStateForTests();
});

process.env.FULFIL_MODE = "mock";
process.env.OUTLAYER_API_KEY = "";
process.env.NEAR_AI_API_KEY = "";
process.env.SAGE_API_KEY = "";
