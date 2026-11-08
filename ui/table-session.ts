import type { Level } from './game.ts'
import { createCards, playCards } from './guandan.ts'
import type { CardState, SeatId } from './guandan.ts'
import { actMahjong, createMahjong } from './mahjong.ts'
import type { MahjongAction, MahjongState, MahjongVariant } from './mahjong.ts'
import { undoLimit } from './storage.ts'

export type TableKind = 'guandan' | 'mahjong'
export type TableState = CardState | MahjongState
export type TableAction = { game: 'guandan'; cards: number[] | null; shapeKey?: string } | { game: 'mahjong'; action: MahjongAction }
type Entry = { seat: SeatId; action: TableAction }
export type TableSession = { kind: TableKind; seed: number; level: Level; actions: Entry[]; undoStreak: number; state: TableState; variant?:MahjongVariant }
export const tableKey = (kind: TableKind,variant:MahjongVariant='basic') => `dsh-board-games-${kind}${kind==='mahjong'&&variant!=='basic'?'-'+variant:''}-v1`
export function seeded(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
export function newTable(kind: TableKind, level: Level, seed = Math.floor(Math.random() * 4294967296),variant:MahjongVariant='basic'): TableSession {
  return { kind, seed, level, actions: [], undoStreak: 0, ...(variant!=='basic'?{variant}:{}), state: kind === 'guandan' ? createCards(seeded(seed)) : createMahjong(seeded(seed),variant) }
}
export function tableAct(session: TableSession, seat: SeatId, action: TableAction): { session: TableSession; error?: string } {
  const state = session.state
  const result = state.kind === 'guandan' && action.game === 'guandan' ? playCards(state, seat, action.cards, action.shapeKey)
    : state.kind === 'mahjong' && action.game === 'mahjong' ? actMahjong(state, seat, action.action) : { state, error: '动作不属于这张桌子' }
  if (result.error) return { session, error: result.error }
  return { session: { ...session, state: result.state, actions: [...session.actions, { seat, action }], undoStreak: seat === 0 ? 0 : session.undoStreak } }
}
export function encodeTable(session: TableSession): string {
  return JSON.stringify({ version: 1, kind: session.kind, seed: session.seed, level: session.level, actions: session.actions, undoStreak: session.undoStreak, ...(session.variant?{variant:session.variant}:{}) })
}
export function restoreTable(raw: string | null, expected: TableKind,variant:MahjongVariant='basic'): TableSession | null {
  try {
    const data = JSON.parse(raw || 'null')
    if (!data || data.version !== 1 || data.kind !== expected || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 4294967295 || ![0, 1, 2, 3, 4].includes(data.level) || !Array.isArray(data.actions) || data.actions.length > 3000) return null
    if((data.variant||'basic')!==variant||!['basic','sichuan','bloodflow','guangdong'].includes(variant))return null
    let session = newTable(expected, data.level, data.seed,variant)
    for (const entry of data.actions) {
      if (![0, 1, 2, 3].includes(entry.seat) || !entry.action) return null
      const result = tableAct(session, entry.seat, entry.action)
      if (result.error) return null
      session = result.session
    }
    session.undoStreak = Number.isInteger(data.undoStreak) ? Math.max(0, Math.min(undoLimit(data.level), data.undoStreak)) : 0
    return session
  } catch { return null }
}
export function undoTable(session: TableSession): TableSession {
  if (session.state.phase === 'finished' || session.undoStreak >= undoLimit(session.level)) return session
  let index = session.actions.length - 1
  while (index >= 0 && session.actions[index].seat !== 0) index--
  if (index < 0) return session
  let restored = newTable(session.kind, session.level, session.seed,session.variant)
  for (const entry of session.actions.slice(0, index)) restored = tableAct(restored, entry.seat, entry.action).session
  return { ...restored, undoStreak: session.undoStreak + 1 }
}
