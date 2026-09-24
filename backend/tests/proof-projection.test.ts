import { describe, expect, it } from 'vitest';
import { taskDeltas } from '../src/services/proof-projection';

describe('taskDeltas', () => {
  it('open → done closes a task and counts it', () => expect(taskDeltas('open', 'done')).toEqual({ tasksDone: 1, openTasks: -1 }));
  it('done → open reverses both', () => expect(taskDeltas('done', 'open')).toEqual({ tasksDone: -1, openTasks: 1 }));
  it('submitted → reviewed is neutral', () => expect(taskDeltas('submitted', 'reviewed')).toEqual({ tasksDone: 0, openTasks: 0 }));
  it('open → dropped only closes', () => expect(taskDeltas('open', 'dropped')).toEqual({ tasksDone: 0, openTasks: -1 }));
  it('new task (null → open) opens', () => expect(taskDeltas(null, 'open')).toEqual({ tasksDone: 0, openTasks: 1 }));
});
