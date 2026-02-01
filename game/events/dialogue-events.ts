const DIALOGUE_OPEN_EVENT = "dialogue:open";
const DIALOGUE_CLOSE_EVENT = "dialogue:close";

const dialogueEventTarget = new EventTarget();

export function emitDialogueOpen(detail: DialogueOpenDetail) {
  dialogueEventTarget.dispatchEvent(new CustomEvent(DIALOGUE_OPEN_EVENT, { detail }));
}

export function emitDialogueClose() {
  dialogueEventTarget.dispatchEvent(new CustomEvent(DIALOGUE_CLOSE_EVENT));
}

export function onDialogueOpen(handler: (detail: DialogueOpenDetail) => void) {
  function handleEvent(event: Event) {
    const customEvent = event as CustomEvent<DialogueOpenDetail>;
    handler(customEvent.detail);
  }

  dialogueEventTarget.addEventListener(DIALOGUE_OPEN_EVENT, handleEvent);

  return function unsubscribe() {
    dialogueEventTarget.removeEventListener(DIALOGUE_OPEN_EVENT, handleEvent);
  };
}

export function onDialogueClose(handler: () => void) {
  function handleEvent() {
    handler();
  }

  dialogueEventTarget.addEventListener(DIALOGUE_CLOSE_EVENT, handleEvent);

  return function unsubscribe() {
    dialogueEventTarget.removeEventListener(DIALOGUE_CLOSE_EVENT, handleEvent);
  };
}

export interface DialogueOpenDetail {
  npcId: string;
  npcName: string;
  npcRole: string;
  prompt: string;
}
