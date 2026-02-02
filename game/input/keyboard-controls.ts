export const KEY_CODE = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  SPACE: 32,
  A: 65,
  D: 68,
  E: 69,
  S: 83,
  W: 87,
} as const;

export const CHAT_SAFE_KEY_CODES = [
  KEY_CODE.W,
  KEY_CODE.A,
  KEY_CODE.S,
  KEY_CODE.D,
  KEY_CODE.E,
  KEY_CODE.SPACE,
  KEY_CODE.LEFT,
  KEY_CODE.UP,
  KEY_CODE.RIGHT,
  KEY_CODE.DOWN,
];

export interface KeyLike {
  isDown: boolean;
}

export interface CursorKeysLike<KeyType extends KeyLike = KeyLike> {
  left: KeyType;
  right: KeyType;
  up: KeyType;
  down: KeyType;
}

export interface MovementKeys<KeyType extends KeyLike = KeyLike> {
  up: KeyType;
  left: KeyType;
  down: KeyType;
  right: KeyType;
}

export interface KeyboardPluginLike<KeyType extends KeyLike = KeyLike> {
  addKeys: (
    keys: string,
    enableCapture?: boolean,
    emitOnRepeat?: boolean
  ) => Record<string, KeyType> | object;
  addKey: (keyCode: number, enableCapture?: boolean, emitOnRepeat?: boolean) => KeyType;
  createCursorKeys: () => CursorKeysLike<KeyType>;
  removeCapture?: (keyCodes: number[]) => void;
}

export interface KeyboardControls<KeyType extends KeyLike = KeyLike> {
  cursors: CursorKeysLike<KeyType>;
  wasdKeys: MovementKeys<KeyType>;
  interactKeys: KeyType[];
}

export function setupKeyboardControls<KeyType extends KeyLike>(
  input: KeyboardPluginLike<KeyType>
): KeyboardControls<KeyType> {
  const cursors = input.createCursorKeys();
  const keys = input.addKeys("W,A,S,D", false) as Record<string, KeyType>;
  const wasdKeys: MovementKeys<KeyType> = {
    up: keys.W,
    left: keys.A,
    down: keys.S,
    right: keys.D,
  };
  const interactKeys = [
    input.addKey(KEY_CODE.SPACE, false),
    input.addKey(KEY_CODE.E, false),
  ];

  input.removeCapture?.(CHAT_SAFE_KEY_CODES);

  return { cursors, wasdKeys, interactKeys };
}
