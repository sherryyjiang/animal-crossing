# Memory Schema and Retrieval Weights

## Core Records

### Conversation Log
- `id`
- `npcId`
- `dayIndex`
- `timestamp`
- `speaker` ("player" | "npc")
- `text`

### Memory Fact
- `id`
- `npcId`
- `type` (emotion | preference | relationship | schedule | goal | task | item | event)
- `content`
- `tags` (string[])
- `status` (open | done, optional for tasks)
- `threadId` (string, optional)
- `threadSequence` (number, optional)
- `anchors` (array of { type, value }, optional)
- `links` (array of { targetId, label }, optional)
- `salience` (0-1)
- `createdAt`
- `lastMentionedAt`

### Player Summary (per NPC)
- `npcId`
- `summary`
- `updatedAt`

## Retrieval Scoring (Draft)
```
score = (recencyWeight * recency) +
        (salienceWeight * salience) +
        (typeWeight * typeMatch)
```
- `recency`: 0-1 normalized by age
- `salience`: stored score (0-1)
- `typeMatch`: 1 if type aligns with NPC focus, else 0.3

## NPC-Specific Weights
| NPC | recencyWeight | salienceWeight | typeWeight |
|---|---:|---:|---:|
| Bartender | 0.25 | 0.45 | 0.30 |
| Shopkeeper | 0.30 | 0.35 | 0.35 |
| Neighbor | 0.25 | 0.30 | 0.45 |
| Librarian | 0.20 | 0.35 | 0.45 |

## Type Focus (Type Match)
- **Bartender**: emotion, event, relationship, task
- **Shopkeeper**: item, preference, schedule, task
- **Neighbor**: relationship, event, goal, task
- **Librarian**: goal, preference, event, task
