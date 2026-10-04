// The OpenSpec task lists: parsing a tasks.md, finding the boxes an edit checked, picking the active
// change, and the changes with every box checked that still wait for the archive. Pure.

export type Task = { text: string; done: boolean; section: string }

/** A change in openspec/changes/ with its task list, and when the list last changed. */
export type Change = { name: string; tasks: Task[]; mtimeMs: number }

const BOX = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/

export function parseTasks(md: string): Task[] {
  const tasks: Task[] = []
  let section = ''
  for (const line of md.split('\n')) {
    const heading = /^#{2,6}\s+(.*)$/.exec(line)
    if (heading !== null) {
      section = heading[1]!.trim()
      continue
    }
    const box = BOX.exec(line)
    if (box !== null) tasks.push({ text: box[2]!.trim(), done: box[1] !== ' ', section })
  }
  return tasks
}

export const openCount = (tasks: readonly Task[]): number => tasks.filter(t => !t.done).length

/** The indexes of the tasks that were open before and are checked after, matched by their text. */
export function newlyChecked(before: readonly Task[], after: readonly Task[]): number[] {
  const used = new Set<number>()
  const out: number[] = []
  after.forEach((task, i) => {
    if (!task.done) return
    const was = before.findIndex((b, j) => !used.has(j) && b.text === task.text)
    if (was >= 0) {
      used.add(was)
      if (!before[was]!.done) out.push(i)
    }
  })
  return out
}

/** The change a path's tasks.md belongs to, or null: openspec/changes/<name>/tasks.md, not the archive. */
export function changeOfPath(file: string): string | null {
  const m = /(?:^|\/)openspec\/changes\/([^/]+)\/tasks\.md$/.exec(file.replace(/\\/g, '/'))
  return m === null || m[1] === 'archive' ? null : m[1]!
}

/** The change the session last edited a task list of, else the latest one with open tasks. */
export function activeChange(changes: readonly Change[], lastEdited: string | null): Change | null {
  const edited = lastEdited === null ? undefined : changes.find(c => c.name === lastEdited)
  if (edited !== undefined) return edited
  const open = changes.filter(c => openCount(c.tasks) > 0).sort((a, b) => b.mtimeMs - a.mtimeMs)
  return open[0] ?? null
}

/** The changes with every box checked that are not archived yet. */
export const stageClear = (changes: readonly Change[]): string[] =>
  changes.filter(c => c.tasks.length > 0 && openCount(c.tasks) === 0).map(c => c.name).sort()
