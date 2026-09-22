import type { Conversation, LearningMessage, MessagePayload, MessageType } from '../contracts/api';
import type { ConversationMemberRow, ConversationRow, MessageRow } from '../db/rows';
import type { PersonRef } from './profile';

export function toMessage(r: MessageRow): LearningMessage {
  let payload: MessagePayload;
  try {
    payload = JSON.parse(r.payloadJson ?? '') as MessagePayload;
  } catch {
    payload = { type: 'system', text: 'Unavailable message' };
  }
  return {
    id: r.$id, conversationId: r.conversationId, sequence: r.sequence, senderId: r.senderId, type: r.type as MessageType,
    payloadVersion: 1, payload: r.removedAt ? { type: 'system', text: 'This message was removed.' } : payload,
    clientMessageId: r.clientMessageId, createdAt: r.createdAt, removedAt: r.removedAt,
  };
}

export function toConversation(c: ConversationRow, m: ConversationMemberRow, last: MessageRow | null, counterpart: PersonRef | null): Conversation {
  return {
    id: c.$id, relationId: c.relationId, memberIds: c.memberIds, lastMessage: last ? toMessage(last) : null,
    lastSequence: c.lastSequence, myLastReadSequence: m.lastReadSequence,
    unreadCount: Math.max(0, c.lastSequence - m.lastReadSequence), counterpart, updatedAt: c.lastMessageAt ?? c.updatedAt,
  };
}
