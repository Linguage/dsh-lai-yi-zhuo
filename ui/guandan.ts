import type { Level } from './game.ts'

export type SeatId = 0 | 1 | 2 | 3
export type Card = number
export type Shape = 'single' | 'pair' | 'triple' | 'full' | 'straight' | 'pairs' | 'triples' | 'bomb' | 'flush' | 'jokers'
export type CardMove = { cards: Card[]; kind: Shape; rank: number; key: string; label: string }
type Template = { kind: Shape; rank: number; ranks: number[]; suit?: number; key: string; label: string }
export type CardState = {
  kind: 'guandan'; hands: Card[][]; turn: SeatId; phase: 'playing' | 'finished'
  last: { seat: SeatId; move: CardMove } | null; passed: SeatId[]; order: SeatId[]
  plays: (CardMove | 'pass' | null)[]; played: Card[]; step: number; message: string
  winner: 0 | 1 | null; reason: string
}
export type CardObservation = Pick<CardState, 'last' | 'order' | 'played'> & { hand: Card[]; seat: SeatId; counts: number[] }
export const nextSeat = (seat: number) => ((seat + 1) % 4) as SeatId
export const partner = (seat: number) => ((seat + 2) % 4) as SeatId
export const cardRank = (card: Card) => card % 54 >= 52 ? card % 54 - 36 : card % 54 % 13 + 2
export const cardSuit = (card: Card) => card % 54 >= 52 ? -1 : Math.floor(card % 54 / 13)
export const isWild = (card: Card) => cardRank(card) === 2 && cardSuit(card) === 1
export const rankPower = (rank: number) => rank === 2 ? 15 : rank
export const rankLabel = (rank: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 16: '小王', 17: '大王' }[rank] || String(rank))
export const suitLabels = ['♠', '♥', '♣', '♦']
export const cardLabel = (card: Card) => `${cardSuit(card) < 0 ? '' : suitLabels[cardSuit(card)]}${rankLabel(cardRank(card))}${isWild(card) ? ' 配牌' : ''}`
export const sortCards = (cards: Card[]) => [...cards].sort((a, b) => rankPower(cardRank(b)) - rankPower(cardRank(a)) || cardSuit(a) - cardSuit(b) || a - b)
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}

const names: Record<Shape, string> = { single: '单张', pair: '对子', triple: '三张', full: '三带二', straight: '顺子', pairs: '三连对', triples: '钢板', bomb: '炸弹', flush: '同花顺', jokers: '四王炸' }
const templates: Template[] = []
function template(kind: Shape, rank: number, ranks: number[], suit?: number) {
  templates.push({ kind, rank, ranks, suit, key: `${kind}:${rank}:${ranks.join(',')}:${suit ?? ''}`, label: `${kind === 'bomb' ? ranks.length + ' 张' : ''}${names[kind]}${kind === 'jokers' ? '' : ' · ' + rankLabel(rank)}` })
}
for (const rank of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17]) {
  template('single', rank, [rank]); template('pair', rank, [rank, rank])
  if (rank > 14) continue
  template('triple', rank, [rank, rank, rank])
  for (let n = 4; n <= 10; n++) template('bomb', rank, Array(n).fill(rank))
  for (const pairRank of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17])
    if (rank !== pairRank) template('full', rank, [rank, rank, rank, pairRank, pairRank])
}
for (const [kind, length, copies] of [['straight', 5, 1], ['pairs', 3, 2], ['triples', 2, 3]] as const) {
  for (let start = 1; start <= 15 - length; start++) {
    const ranks = Array.from({ length }, (_, i) => start + i === 1 ? 14 : start + i)
    const required = ranks.flatMap(rank => Array(copies).fill(rank))
    template(kind, start + length - 1, required)
    if (kind === 'straight') for (let suit = 0; suit < 4; suit++) template('flush', start + length - 1, required, suit)
  }
}
template('jokers', 17, [16, 16, 17, 17])

function match(hand: Card[], t: Template, exact: boolean): CardMove | null {
  if (exact && hand.length !== t.ranks.length || hand.length < t.ranks.length) return null
  const pool = [...hand], cards: Card[] = []
  // Natural cards first; hearts of the level rank may fill any non-joker slot.
  const missing: number[] = []
  for (const rank of t.ranks) {
    const index = pool.findIndex(card => !isWild(card) && cardRank(card) === rank && (t.suit === undefined || cardSuit(card) === t.suit))
    if (index >= 0) cards.push(...pool.splice(index, 1)); else missing.push(rank)
  }
  for (const rank of missing) {
    const index = pool.findIndex(card => isWild(card) && rank < 16 && (t.kind !== 'single' || rank === 2))
    if (index < 0) return null
    cards.push(...pool.splice(index, 1))
  }
  if (exact && pool.length) return null
  return { cards: sortCards(cards), kind: t.kind, rank: t.rank, key: t.key, label: t.label }
}
const strength = (move: CardMove) => move.kind === 'jokers' ? 10000 : move.kind === 'flush' ? 550 + move.rank : move.kind === 'bomb' ? move.cards.length * 100 + rankPower(move.rank) : 0
export function beats(move: CardMove, previous: CardMove | null) {
  if (!previous) return true
  const a = strength(move), b = strength(previous)
  if (a || b) return a > b
  if (move.kind !== previous.kind) return false
  const sequence = ['straight', 'pairs', 'triples'].includes(move.kind)
  return (sequence ? move.rank : rankPower(move.rank)) > (sequence ? previous.rank : rankPower(previous.rank))
}
export function classify(cards: Card[]): CardMove[] {
  if (new Set(cards).size !== cards.length || cards.some(c => !Number.isInteger(c) || c < 0 || c >= 108)) return []
  return templates.flatMap(t => { const m = match(cards, t, true); return m ? [m] : [] })
}
export function legalCardMoves(observation: CardObservation): CardMove[] {
  return templates.flatMap(t => { const m = match(observation.hand, t, false); return m && beats(m, observation.last?.move ?? null) ? [m] : [] })
}
export function createCards(random = Math.random): CardState {
  const deck = shuffle(Array.from({ length: 108 }, (_, i) => i), random)
  return { kind: 'guandan', hands: Array.from({ length: 4 }, (_, seat) => sortCards(deck.slice(seat * 27, seat * 27 + 27))), turn: 0, phase: 'playing', last: null, passed: [], order: [], plays: [null, null, null, null], played: [], step: 0, message: '', winner: null, reason: '' }
}
export function observeCards(state: CardState, seat: SeatId): CardObservation {
  return { hand: [...state.hands[seat]], seat, counts: state.hands.map(h => h.length), last: state.last ? structuredClone(state.last) : null, order: [...state.order], played: [...state.played] }
}
export function playCards(state: CardState, seat: SeatId, cards: Card[] | null, shapeKey?: string): { state: CardState; error?: string } {
  const invalid = (error: string) => ({ state, error })
  if (state.phase !== 'playing' || state.turn !== seat) return invalid('还没轮到你')
  let move: CardMove | null = null
  if (cards !== null) {
    if (!cards.length || cards.some(c => !state.hands[seat].includes(c))) return invalid('请选择手中的牌')
    const matches = classify(cards).filter(m => beats(m, state.last?.move ?? null))
    move = matches.find(m => m.key === shapeKey) ?? (!shapeKey ? matches[0] : null) ?? null
    if (!move) return invalid('牌型不成立，或没有压过上一手')
  } else if (!state.last) return invalid('领出时需要出牌')
  const s = structuredClone(state); s.step++; s.message = ''
  if (move) {
    s.hands[seat] = s.hands[seat].filter(c => !move!.cards.includes(c)); s.played.push(...move.cards)
    s.last = { seat, move }; s.passed = []; s.plays[seat] = move
    if (!s.hands[seat].length) s.order.push(seat)
    // Single-deal practice ends after the third finisher; rankings stay unambiguous.
    if (s.order.length === 3) {
      s.order.push(([0, 1, 2, 3] as SeatId[]).find(p => !s.order.includes(p))!)
      s.phase = 'finished'; s.winner = (s.order[0] % 2) as 0 | 1
      const partnerRank = s.order.indexOf(partner(s.order[0])) + 1
      s.reason = partnerRank === 2 ? '双上' : partnerRank === 3 ? '头游与三游' : '头游与末游'
      return { state: s }
    }
  } else { s.passed.push(seat); s.plays[seat] = 'pass' }
  const active = ([0, 1, 2, 3] as SeatId[]).filter(p => s.hands[p].length)
  if (s.last && active.every(p => p === s.last!.seat || s.passed.includes(p))) {
    let lead = s.last.seat
    if (!s.hands[lead].length) {
      lead = partner(lead)
      if (!s.hands[lead].length) { lead = nextSeat(s.last.seat); while (!s.hands[lead].length) lead = nextSeat(lead) }
      s.message = '接风'
    }
    s.turn = lead; s.last = null; s.passed = []; s.plays = [null, null, null, null]
  } else { s.turn = nextSeat(seat); while (!s.hands[s.turn].length) s.turn = nextSeat(s.turn) }
  return { state: s }
}

export function chooseCards(o: CardObservation, level: Level, random = Math.random): CardMove | null {
  const moves = legalCardMoves(o)
  if (!moves.length) return null
  const finish = moves.find(m => m.cards.length === o.hand.length)
  if (finish) return finish
  if (o.last?.seat === partner(o.seat) && level >= 1) return null
  if (level === 0) {
    const ordinary = moves.filter(m => !strength(m)), pool = ordinary.length ? ordinary : moves
    return pool[Math.floor(random() * pool.length)]
  }
  const rankCounts = new Map<number, number>()
  o.hand.forEach(c => rankCounts.set(cardRank(c), (rankCounts.get(cardRank(c)) || 0) + 1))
  const danger = o.counts.some((n, p) => p % 2 !== o.seat % 2 && n > 0 && n <= 3)
  const cost = (m: CardMove) => {
    let value = rankPower(m.rank) * .5 - m.cards.length * (o.last ? 1 : 6)
    value += strength(m) ? (danger ? 5 : 45) : 0
    value += m.cards.filter(isWild).length * (level >= 2 ? 13 : 2)
    if (level >= 2) for (const rank of new Set(m.cards.map(cardRank))) {
      const used = m.cards.filter(c => cardRank(c) === rank).length, total = rankCounts.get(rank) || 0
      if (used < total) value += total >= 4 ? 26 : total * 2
    }
    if (level >= 3) {
      const rest = o.hand.filter(c => !m.cards.includes(c)), counts = new Map<number, number>()
      rest.forEach(c => counts.set(cardRank(c), (counts.get(cardRank(c)) || 0) + 1))
      value += [...counts.values()].filter(n => n === 1).length * 3
      if (danger && o.last && m.kind === 'single') value -= rankPower(m.rank) * 1.5
      if (level === 4) value += counts.size * 2
    }
    return value
  }
  moves.sort((a, b) => cost(a) - cost(b))
  if (o.last && strength(moves[0]) && !danger && o.hand.length > 8) return null
  return moves[level === 1 ? Math.floor(random() * Math.min(3, moves.length)) : 0]
}

/** Public remaining-card progress, deliberately not presented as a win probability. */
export function cardProgress(state: CardState) {
  return [54 - state.hands[0].length - state.hands[2].length, 54 - state.hands[1].length - state.hands[3].length]
}
