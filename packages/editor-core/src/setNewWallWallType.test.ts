import { describe, expect, it } from 'vitest';
import { executeCommand } from './pure/reduceCommand.js';
import { createInitialEditorState } from './store/editorStore.js';

describe('setNewWallWallType', () => {
  it('обновляет view без изменения draft', () => {
    const st = createInitialEditorState();
    const r = executeCommand({ type: 'setNewWallWallType', wallType: 'internal' }, st);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.view.newWallWallType).toBe('internal');
    expect(r.draftChanged).toBe(false);
  });
});
