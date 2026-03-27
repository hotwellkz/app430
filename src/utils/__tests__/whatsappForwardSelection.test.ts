import { describe, expect, it } from 'vitest';
import type { WhatsAppMessage } from '../../types/whatsappDb';
import {
  buildForwardPayloadMessages,
  formatForwardMessageCountRu,
  getOrderedSelectedMessages,
  isMessageForwardable
} from '../whatsappForwardSelection';

function msg(partial: Partial<WhatsAppMessage> & { id: string }): WhatsAppMessage {
  return {
    id: partial.id,
    conversationId: partial.conversationId ?? 'c1',
    channel: partial.channel ?? 'whatsapp',
    text: partial.text ?? '',
    direction: partial.direction ?? 'incoming',
    createdAt: partial.createdAt ?? new Date(),
    deleted: partial.deleted,
    attachments: partial.attachments,
    ...partial
  } as WhatsAppMessage;
}

describe('whatsappForwardSelection', () => {
  describe('getOrderedSelectedMessages', () => {
    it('сохраняет порядок сообщений как в ленте чата, а не порядок id в выборе', () => {
      const messages = [
        msg({ id: 'a', text: '1' }),
        msg({ id: 'b', text: '2' }),
        msg({ id: 'c', text: '3' })
      ];
      const selectedIds = ['c', 'a', 'b'];
      const ordered = getOrderedSelectedMessages(messages, selectedIds);
      expect(ordered.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    });

    it('возвращает пустой массив при пустом выборе', () => {
      expect(getOrderedSelectedMessages([msg({ id: 'x', text: 'y' })], [])).toEqual([]);
    });
  });

  describe('isMessageForwardable', () => {
    it('пропускает удалённые', () => {
      expect(isMessageForwardable(msg({ id: '1', text: 'hi', deleted: true }))).toBe(false);
    });

    it('принимает текст без вложений', () => {
      expect(isMessageForwardable(msg({ id: '1', text: ' hi ' }))).toBe(true);
    });

    it('принимает вложение с url без текста', () => {
      expect(
        isMessageForwardable(
          msg({
            id: '1',
            text: '',
            attachments: [{ type: 'image', url: 'https://x.test/a.jpg' }]
          })
        )
      ).toBe(true);
    });

    it('отклоняет пустое без вложений', () => {
      expect(isMessageForwardable(msg({ id: '1', text: '   ' }))).toBe(false);
    });
  });

  describe('buildForwardPayloadMessages', () => {
    it('собирает только пересылаемые в порядке чата и считает пропуски', () => {
      const messages = [
        msg({ id: 'a', text: 'ok' }),
        msg({ id: 'b', deleted: true, text: 'x' }),
        msg({ id: 'c', text: '' }),
        msg({ id: 'd', text: 'z' })
      ];
      const { forwardable, skipped } = buildForwardPayloadMessages(messages, ['d', 'c', 'b', 'a']);
      expect(forwardable.map((m) => m.id)).toEqual(['a', 'd']);
      expect(skipped).toBe(2);
    });
  });

  describe('formatForwardMessageCountRu', () => {
    it('склоняет 1 / 2 / 5 / 11', () => {
      expect(formatForwardMessageCountRu(1)).toBe('1 сообщение');
      expect(formatForwardMessageCountRu(2)).toBe('2 сообщения');
      expect(formatForwardMessageCountRu(5)).toBe('5 сообщений');
      expect(formatForwardMessageCountRu(11)).toBe('11 сообщений');
      expect(formatForwardMessageCountRu(21)).toBe('21 сообщение');
    });
  });
});
