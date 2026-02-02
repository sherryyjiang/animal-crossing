"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  emitDialogueClose,
  onDialogueOpen,
} from "../game/events/dialogue-events";
import type { DialogueOpenDetail } from "../game/events/dialogue-events";
import {
  appendConversationEntry,
  initializeConversationLog,
} from "../game/logs/conversation-log";
import { markNpcVisited } from "../game/day-cycle";
import { extractAndStoreMemories } from "../game/memory/memory-pipeline";
import { initializeMemoryStore } from "../game/memory/memory-store";
import { buildNpcMemoryContext } from "../game/memory/memory-retrieval";
import type { NpcMemoryContext } from "../game/memory/memory-retrieval";
import type { MemoryFact } from "../game/memory/memory-types";
import { llmAdapter } from "../game/llm/llm-adapter";
import { buildNpcChatInput } from "../game/llm/npc-chat";

export function DialogueOverlay() {
  const [activeSession, setActiveSession] = useState<DialogueSession | null>(null);
  const [inputValue, setInputValue] = useState("");
  const replyTimerRef = useRef<number | null>(null);
  const replyTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void initializeConversationLog();
    void initializeMemoryStore();
    const unsubscribe = onDialogueOpen((detail) => {
      clearReplyTimer(replyTimerRef);
      replyTokenRef.current = null;
      void (async () => {
        const memoryContext = await buildNpcMemoryContext({
          npcId: detail.npcId,
          npcName: detail.npcName,
          npcRole: detail.npcRole,
        });
        if (!isMounted) return;
        const greeting = createGreeting(detail.npcName, memoryContext);
        setActiveSession(createDialogueSession(detail, greeting, memoryContext));
        setInputValue("");
        appendConversationEntry({
          npcId: detail.npcId,
          speaker: "npc",
          text: greeting,
        });
      })();
    });

    return () => {
      isMounted = false;
      clearReplyTimer(replyTimerRef);
      unsubscribe();
    };
  }, []);

  const isOpen = Boolean(activeSession);
  const isContinueEnabled = Boolean(activeSession?.hasNpcReply);
  const isSendDisabled = !activeSession || activeSession.hasPlayerLine;

  const dialogueLines = activeSession?.lines ?? [];

  function handleSend() {
    if (!activeSession || activeSession.hasPlayerLine) return;
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    const playerEntry = appendConversationEntry({
      npcId: activeSession.npcId,
      speaker: "player",
      text: trimmedInput,
    });
    const nextSession = createPlayerLine(activeSession, trimmedInput);
    setActiveSession(nextSession);
    setInputValue("");

    const replyToken = `${activeSession.npcId}-${Date.now()}`;
    replyTokenRef.current = replyToken;
    clearReplyTimer(replyTimerRef);

    void (async () => {
      const { reply, errorMessage } = await generateNpcReply(activeSession, trimmedInput);
      if (replyTokenRef.current !== replyToken) {
        return;
      }

      replyTimerRef.current = window.setTimeout(() => {
        const npcEntry = appendConversationEntry({
          npcId: activeSession.npcId,
          speaker: "npc",
          text: reply,
        });
        void extractAndStoreMemories(activeSession.npcId, [playerEntry, npcEntry]);
        void markNpcVisited(activeSession.npcId);
        setActiveSession((current) => {
          if (!current || current.npcId !== activeSession.npcId) return current;
          return createNpcReplySession(current, reply, errorMessage);
        });
        clearReplyTimer(replyTimerRef);
      }, DIALOGUE_PACING.npcReplyDelayMs);
    })();
  }

  function handleContinue() {
    clearReplyTimer(replyTimerRef);
    replyTokenRef.current = null;
    emitDialogueClose();
    setActiveSession(null);
    setInputValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  }

  if (!isOpen || !activeSession) return null;

  return (
    <div className="dialogue-overlay">
      <div className="dialogue-panel">
        <div className="dialogue-header">
          <div className="dialogue-title">
            <span className="dialogue-name">{activeSession.npcName}</span>
            <span className="dialogue-role">{activeSession.npcRole}</span>
          </div>
          <button type="button" className="dialogue-close" onClick={handleContinue}>
            Close
          </button>
        </div>
        <div className="dialogue-lines">
          {dialogueLines.map((line) => (
            <div
              key={line.id}
              className={`dialogue-line ${line.speaker === "player" ? "is-player" : "is-npc"}`}
            >
              <span className="dialogue-speaker">
                {line.speaker === "player" ? "You" : activeSession.npcName}
              </span>
              <span className="dialogue-text">{line.text}</span>
            </div>
          ))}
          {activeSession.isNpcTyping ? (
            <div className="dialogue-line is-npc is-typing">
              <span className="dialogue-speaker">{activeSession.npcName}</span>
              <span className="dialogue-text dialogue-typing">
                <span className="dialogue-typing-dot" />
                <span className="dialogue-typing-dot" />
                <span className="dialogue-typing-dot" />
              </span>
            </div>
          ) : null}
        </div>
        <div className="dialogue-input">
          <input
            type="text"
            placeholder={activeSession.prompt}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={activeSession.hasPlayerLine}
          />
          <button type="button" onClick={handleSend} disabled={isSendDisabled || !inputValue.trim()}>
            Send
          </button>
        </div>
        <div className="dialogue-actions">
          <button type="button" onClick={handleContinue} disabled={!isContinueEnabled}>
            Continue
          </button>
        </div>
        {activeSession.errorMessage ? (
          <div className="dialogue-error">{activeSession.errorMessage}</div>
        ) : null}
      </div>
    </div>
  );
}

function createDialogueSession(
  detail: DialogueOpenDetail,
  greeting: string,
  memoryContext: NpcMemoryContext
): DialogueSession {
  return {
    npcId: detail.npcId,
    npcName: detail.npcName,
    npcRole: detail.npcRole,
    prompt: detail.prompt,
    memoryContext,
    hasPlayerLine: false,
    hasNpcReply: false,
    isNpcTyping: false,
    errorMessage: null,
    lines: [
      {
        id: createLineId(),
        speaker: "npc",
        text: greeting,
      },
    ],
  };
}

function createPlayerLine(session: DialogueSession, playerText: string): DialogueSession {
  return {
    ...session,
    hasPlayerLine: true,
    hasNpcReply: false,
    isNpcTyping: true,
    lines: [
      ...session.lines,
      {
        id: createLineId(),
        speaker: "player" as const,
        text: playerText,
      },
    ],
  };
}

function createNpcReplySession(
  session: DialogueSession,
  npcReply: string,
  errorMessage: string | null
): DialogueSession {
  return {
    ...session,
    hasPlayerLine: false,
    hasNpcReply: true,
    isNpcTyping: false,
    errorMessage,
    lines: [
      ...session.lines,
      {
        id: createLineId(),
        speaker: "npc" as const,
        text: npcReply,
      },
    ],
  };
}

function createGreeting(npcName: string, memoryContext: NpcMemoryContext) {
  const recall = formatMemoryRecall(memoryContext.topMemories[0]);
  const recallLine = recall ? ` ${recall}` : " What would you like to share today?";
  return `${npcName} ${memoryContext.profile.greetingStyle}${recallLine}`;
}

async function generateNpcReply(session: DialogueSession, playerText: string) {
  try {
    const chatInput = buildNpcChatInput({
      npcId: session.npcId,
      npcName: session.npcName,
      npcRole: session.npcRole,
      memoryContext: session.memoryContext,
      conversationHistory: session.lines.map((line) => ({
        speaker: line.speaker,
        text: line.text,
      })),
      playerText,
    });
    const response = await llmAdapter.generateReply(chatInput);
    return { reply: response.text, errorMessage: null };
  } catch (error) {
    return { reply: createFallbackReply(session, playerText), errorMessage: "LLM unavailable. Using fallback reply." };
  }
}

function createFallbackReply(session: DialogueSession, playerText: string) {
  const recall = formatMemoryRecall(session.memoryContext.topMemories[0]);
  const recallLine = recall ? ` ${recall}` : "";
  return `${session.npcName} ${session.memoryContext.profile.replyStyle} \"${playerText}\"${recallLine}`;
}

function formatMemoryRecall(fact?: MemoryFact) {
  if (!fact) return "";
  const sentence = normalizeMemorySentence(fact.content);
  return `I remember ${lowercaseFirstLetter(sentence)}.`;
}

function normalizeMemorySentence(content: string) {
  const sentence = content.replace(/^player /i, "you ");
  return sentence.replace(/^you feels /i, "you felt ");
}

function lowercaseFirstLetter(text: string) {
  if (!text) return text;
  return text[0].toLowerCase() + text.slice(1);
}

function createLineId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clearReplyTimer(timerRef: { current: number | null }) {
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

interface DialogueSession {
  npcId: string;
  npcName: string;
  npcRole: string;
  prompt: string;
  memoryContext: NpcMemoryContext;
  hasPlayerLine: boolean;
  hasNpcReply: boolean;
  isNpcTyping: boolean;
  errorMessage: string | null;
  lines: DialogueLine[];
}

interface DialogueLine {
  id: string;
  speaker: "npc" | "player";
  text: string;
}

const DIALOGUE_PACING = {
  npcReplyDelayMs: 650,
};
