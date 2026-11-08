import { test } from "node:test";
import assert from "node:assert/strict";
import { LiteApiLiveService } from "../src/services/providers/liteApiLiveService.ts";

test("LiteApiLiveService detects active sandbox key", () => {
  assert.equal(LiteApiLiveService.isAvailable(), true);
  assert.equal(LiteApiLiveService.capabilities.providerId, "liteapi");
  assert.equal(LiteApiLiveService.capabilities.mode, "sandbox");
});

