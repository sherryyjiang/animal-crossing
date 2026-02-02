import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_SAFE_KEY_CODES,
  KEY_CODE,
  setupKeyboardControls,
} from "../game/input/keyboard-controls";

test("disables key capture for movement and interaction keys", () => {
  const addKeysCalls: Array<{ keys: string; enableCapture?: boolean }> = [];
  const addKeyCalls: Array<{ code: number; enableCapture?: boolean }> = [];
  const removeCaptureCalls: number[][] = [];

  const keys = {
    W: { isDown: false },
    A: { isDown: false },
    S: { isDown: false },
    D: { isDown: false },
  };

  setupKeyboardControls({
    addKeys: (keyString: string, enableCapture?: boolean) => {
      addKeysCalls.push({ keys: keyString, enableCapture });
      return keys;
    },
    addKey: (code: number, enableCapture?: boolean) => {
      addKeyCalls.push({ code, enableCapture });
      return { isDown: false };
    },
    createCursorKeys: () => ({
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
    }),
    removeCapture: (codes: number[]) => {
      removeCaptureCalls.push(codes);
    },
  });

  assert.equal(addKeysCalls.length, 1);
  assert.deepEqual(addKeysCalls[0], { keys: "W,A,S,D", enableCapture: false });

  const codes = addKeyCalls.map((call) => call.code);
  assert.deepEqual(codes, [KEY_CODE.SPACE, KEY_CODE.E]);
  addKeyCalls.forEach((call) => assert.equal(call.enableCapture, false));

  assert.equal(removeCaptureCalls.length, 1);
  assert.deepEqual(removeCaptureCalls[0], CHAT_SAFE_KEY_CODES);
});
