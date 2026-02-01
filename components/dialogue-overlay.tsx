"use client";

import { useEffect, useState } from "react";
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
import { extractAndStoreMemories } from "../game/memory/memory-pipeline";
import { initializeMemoryStore } from "../game/memory/memory-store";
import { buildNpcMemoryContext } from "../game/memory/memory-retrieval";
import type { NpcMemoryContext } from "../game/memory/memory-retrieval";
import type { MemoryFact } from "../game/memory/memory-types";

export function DialogueOverlay(): JSX.Element | null {
  const [activeSession, setActiveSession] = useState<DialogueSession | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    let isMounted = true;
    void initializeConversationLog();
    void initializeMemoryStore();
    const unsubscribe = onDialogueOpen((detail) => {
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

    const npcReply = createNpcReply(activeSession, trimmedInput);
    const playerEntry = appendConversationEntry({
      npcId: activeSession.npcId,
      speaker: "player",
      text: trimmedInput,
    });
    const npcEntry = appendConversationEntry({
      npcId: activeSession.npcId,
      speaker: "npc",
      text: npcReply,
    });
    void extractAndStoreMemories(activeSession.npcId, [playerEntry, npcEntry]);
    const nextSession = createPlayerReply(activeSession, trimmedInput, npcReply);
    setActiveSession(nextSession);
    setInputValue("");
  }

  function handleContinue() {
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
    lines: [
      {
        id: createLineId(),
        speaker: "npc",
        text: greeting,
      },
    ],
  };
}

function createPlayerReply(
  session: DialogueSession,
  playerText: string,
  npcReply: string
): DialogueSession {
  const nextLines = [
    ...session.lines,
    {
      id: createLineId(),
      speaker: "player",
      text: playerText,
    },
    {
      id: createLineId(),
      speaker: "npc",
      text: npcReply,
    },
  ];

  return {
    ...session,
    hasPlayerLine: true,
    hasNpcReply: true,
    lines: nextLines,
  };
}

function createGreeting(npcName: string, memoryContext: NpcMemoryContext) {
  const recall = formatMemoryRecall(memoryContext.topMemories[0]);
  const recallLine = recall ? ` ${recall}` : " What would you like to share today?";
  return `${npcName} ${memoryContext.profile.greetingStyle}${recallLine}`;
}

function createNpcReply(session: DialogueSession, playerText: string) {
  const recall = formatMemoryRecall(session.memoryContext.topMemories[0]);
  const recallLine = recall ? ` ${recall}` : "";
  return `${session.npcName} ${session.memoryContext.profile.replyStyle} "${playerText}"${recallLine}`;
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

interface DialogueSession {
  npcId: string;
  npcName: string;
  npcRole: string;
  prompt: string;
  memoryContext: NpcMemoryContext;
  hasPlayerLine: boolean;
  hasNpcReply: boolean;
  lines: DialogueLine[];
}

interface DialogueLine {
  id: string;
  speaker: "npc" | "player";
  text: string;
}
