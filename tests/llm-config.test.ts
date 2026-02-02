import assert from "node:assert/strict";
import test from "node:test";
import { readLlmEnvValue } from "../game/llm/llm-config";

test("reads public cerebras api key via static env lookup", () => {
  const original = process.env.NEXT_PUBLIC_CEREBRAS_API_KEY;
  process.env.NEXT_PUBLIC_CEREBRAS_API_KEY = "test-key";

  assert.equal(readLlmEnvValue("NEXT_PUBLIC_CEREBRAS_API_KEY"), "test-key");

  if (original === undefined) {
    delete process.env.NEXT_PUBLIC_CEREBRAS_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_CEREBRAS_API_KEY = original;
  }
});

test("returns undefined for unknown env keys", () => {
  assert.equal(readLlmEnvValue("NEXT_PUBLIC_UNKNOWN_KEY"), undefined);
});
