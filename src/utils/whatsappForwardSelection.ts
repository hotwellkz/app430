import type { WhatsAppMessage } from '../types/whatsappDb';

/**
 * Сообщения из выбранных id в порядке следования в ленте чата (а не порядке кликов).
 */
export function getOrderedSelectedMessages(
  messages: WhatsAppMessage[],
  selectedIds: string[]
): WhatsAppMessage[] {
  if (selectedIds.length === 0) return [];
  const set = new Set(selectedIds);
  return messages.filter((m) => set.has(m.id));
}

export function isMessageForwardable(msg: WhatsAppMessage): boolean {
  if (msg.deleted) return false;
  const att = msg.attachments?.[0];
  if (att?.url) return true;
  if ((msg.text ?? '').trim().length > 0) return true;
  return false;
}

export function buildForwardPayloadMessages(
  messages: WhatsAppMessage[],
  selectedIds: string[]
): { forwardable: WhatsAppMessage[]; skipped: number } {
  const ordered = getOrderedSelectedMessages(messages, selectedIds);
  const forwardable = ordered.filter(isMessageForwardable);
  return { forwardable, skipped: ordered.length - forwardable.length };
}

/** Склонение для UI: «N сообщений» */
export function formatForwardMessageCountRu(n: number): string {
  if (n <= 0) return '0 сообщений';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} сообщение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} сообщения`;
  return `${n} сообщений`;
}
