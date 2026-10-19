// Web Worker entry point. Only wires messages to handler.ts; all logic lives there.
import { handleSearch } from "./handler";
import type { EngineRequest, EngineResponse } from "./protocol";

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const response: EngineResponse = handleSearch(event.data);
  self.postMessage(response);
};
