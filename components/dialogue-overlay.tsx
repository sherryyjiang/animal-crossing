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

export function DialogueOverlay(): JSX.Element | null {
  const [activeSession, setActiveSession] = useState<DialogueSession | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    void initializeConversationLog();
    const unsubscribe = onDialogueOpen((detail) => {
      const greeting = createGreeting(detail.npcName);
      setActiveSession(createDialogueSession(detail, greeting));
      setInputValue("");
      appendConversationEntry({
        npcId: detail.npcId,
        speaker: "npc",
        text: greeting,
      });
    });

    return unsubscribe;
  }, []);

  const isOpen = Boolean(activeSession);
  const isContinueEnabled = Boolean(activeSession?.hasNpcReply);
  const isSendDisabled = !activeSession || activeSession.hasPlayerLine;

  const dialogueLines = activeSession?.lines ?? [];

  function handleSend() {
    if (!activeSession || activeSession.hasPlayerLine) return;
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    const npcReply = createNpcReply(activeSession.npcName, trimmedInput);
    appendConversationEntry({
      npcId: activeSession.npcId,
      speaker: "player",
      text: trimmedInput,
    });
    appendConversationEntry({
      npcId: activeSession.npcId,
      speaker: "npc",
      text: npcReply,
    });
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

function createDialogueSession(detail: DialogueOpenDetail, greeting: string): DialogueSession {
  return {
    npcId: detail.npcId,
    npcName: detail.npcName,
    npcRole: detail.npcRole,
    prompt: detail.prompt,
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

function createGreeting(npcName: string) {
  return `${npcName} smiles warmly. What would you like to share today?`;
}

function createNpcReply(npcName: string, playerText: string) {
  return `${npcName} nods. "${playerText}" sounds like a lovely update for the board.`;
}

function createLineId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface DialogueSession {
  npcId: string;
  npcName: string;
  npcRole: string;
  prompt: string;
  hasPlayerLine: boolean;
  hasNpcReply: boolean;
  lines: DialogueLine[];
}

interface DialogueLine {
  id: string;
  speaker: "npc" | "player";
  text: string;
}
