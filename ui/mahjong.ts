import type { Level } from './game.ts'
import { nextSeat, shuffle } from './guandan.ts'
import type { SeatId } from './guandan.ts'

export type Tile = number
export type Meld = { kind: 'chi' | 'peng' | 'gang' | 'concealed'; tiles: Tile[]; from: SeatId }
export type Claim = { kind: 'pass' | 'hu' | 'chi' | 'peng' | 'gang'; tiles: Tile[] }
export type MahjongVariant = 'basic' | 'sichuan' | 'bloodflow' | 'guangdong'
export const mahjongNames:Record<MahjongVariant,string>={basic:'基础麻将',sichuan:'血战到底',bloodflow:'血流成河',guangdong:'广东推倒胡'}
export const isSichuan=(variant:MahjongVariant)=>variant==='sichuan'||variant==='bloodflow'
export type MahjongAction = Claim | { kind: 'discard'; tile: Tile } | { kind: 'concealed' | 'add'; tile: Tile } | {kind:'exchange';tiles:Tile[]} | {kind:'missing';suit:number}
export type MahjongWin={seat:SeatId;from:SeatId|null;tile:Tile;hand:Tile[];value:number;label:string}
export type MahjongState = {
  kind: 'mahjong'; hands: Tile[][]; wall: Tile[]; melds: Meld[][]; rivers: Tile[][]
  turn: SeatId; phase: 'discard' | 'claims' | 'finished' | 'exchange' | 'missing'; drawn: Tile | null; step: number
  pending: { tile: Tile; from: SeatId; rob: number | null; replies: { seat: SeatId; action: Claim }[] } | null
  last: { seat: SeatId; tile: Tile } | null; winner: SeatId | null; reason: string
  variant:MahjongVariant;missing:(number|null)[];exchanges:(Tile[]|null)[];finished:SeatId[];wins:MahjongWin[];wonTiles:Tile[]
  scores:number[];kongLedger:{from:SeatId;to:SeatId;value:number;refunded:boolean}[];passedHu:boolean[];settled:boolean
}
export type MahjongObservation = {
  hand: Tile[]; seat: SeatId; melds: Meld[]; publicTiles: Tile[]; wallCount: number
  phase: MahjongState['phase']; claims: Claim[]; canHu: boolean; kongs: MahjongAction[]
  variant:MahjongVariant;missing:number|null;legalDiscards:Tile[];locked:boolean
}
export const tileType = (tile: Tile) => Math.floor(tile / 4)
const digits = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
export const tileName = (tile: Tile) => {
  const t = tileType(tile)
  return t < 27 ? `${digits[t % 9]}${['万', '筒', '条'][Math.floor(t / 9)]}` : ['东', '南', '西', '北', '中', '发', '白'][t - 27]
}
export const sortTiles = (tiles: Tile[]) => [...tiles].sort((a, b) => a - b)
function countsOf(tiles: Tile[]) { const c = Array(34).fill(0) as number[]; tiles.forEach(t => c[tileType(t)]++); return c }
function groupsComplete(counts: number[]): boolean {
  const i = counts.findIndex(n => n > 0)
  if (i < 0) return true
  if (counts[i] >= 3) {
    counts[i] -= 3; const valid = groupsComplete(counts); counts[i] += 3
    if (valid) return true
  }
  if (i < 27 && i % 9 <= 6 && counts[i + 1] && counts[i + 2]) {
    counts[i]--; counts[i + 1]--; counts[i + 2]--
    const valid = groupsComplete(counts)
    counts[i]++; counts[i + 1]++; counts[i + 2]++
    if (valid) return true
  }
  return false
}
const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
export function isWinning(tiles: Tile[], openMelds = 0): boolean {
  if (tiles.length !== 14 - openMelds * 3) return false
  const c = countsOf(tiles)
  if (!openMelds && c.filter(n => n === 2).length === 7) return true
  if (!openMelds && orphans.every(i => c[i] > 0) && orphans.some(i => c[i] === 2)) return true
  for (let i = 0; i < 34; i++) if (c[i] >= 2) {
    c[i] -= 2; const valid = groupsComplete(c); c[i] += 2
    if (valid) return true
  }
  return false
}

/** Standard hand distance: -1 won, 0 ready, 1 one improvement away. */
export function shanten(tiles: Tile[], openMelds = 0): number {
  const c = countsOf(tiles)
  let best = 8
  if (!openMelds) {
    best = Math.min(6 - c.filter(n => n >= 2).length + Math.max(0, 7 - c.filter(n => n > 0).length),
      13 - orphans.filter(i => c[i] > 0).length - Number(orphans.some(i => c[i] >= 2)))
  }
  const seen = new Set<string>()
  function visit(index: number, melds: number, partials: number, pair: number) {
    while (index < 34 && !c[index]) index++
    if (index >= 34) { best = Math.min(best, 8 - (melds + openMelds) * 2 - Math.min(partials, 4 - melds - openMelds) - pair); return }
    const key = `${index}/${melds}/${partials}/${pair}/${c.slice(index).join('')}`
    if (seen.has(key)) return
    seen.add(key)
    if (c[index] >= 3) { c[index] -= 3; visit(index, melds + 1, partials, pair); c[index] += 3 }
    if (index < 27 && index % 9 < 7 && c[index + 1] && c[index + 2]) {
      c[index]--; c[index + 1]--; c[index + 2]--; visit(index, melds + 1, partials, pair); c[index]++; c[index + 1]++; c[index + 2]++
    }
    if (c[index] >= 2) {
      c[index] -= 2
      if (!pair) visit(index, melds, partials, 1)
      visit(index, melds, partials + 1, pair); c[index] += 2
    }
    if (index < 27) for (const gap of [1, 2]) if (index % 9 + gap < 9 && c[index + gap]) {
      c[index]--; c[index + gap]--; visit(index, melds, partials + 1, pair); c[index]++; c[index + gap]++
    }
    c[index]--; visit(index, melds, partials, pair); c[index]++
  }
  visit(0, 0, 0, 0)
  return best
}

export function createMahjong(random = Math.random, variant:MahjongVariant='basic'): MahjongState {
  const deck = shuffle(Array.from({ length: isSichuan(variant)?108:136 }, (_, i) => i), random)
  const hands = Array.from({ length: 4 }, (_, seat) => sortTiles(deck.slice(seat * 13, seat * 13 + 13)))
  const drawn = deck[52]; hands[0].push(drawn)
  return { kind: 'mahjong', hands, wall: deck.slice(53), melds: [[], [], [], []], rivers: [[], [], [], []], turn: 0, phase: isSichuan(variant)?'exchange':'discard', drawn, step: 0, pending: null, last: null, winner: null, reason: '',variant,missing:[null,null,null,null],exchanges:[null,null,null,null],finished:[],wins:[],wonTiles:[],scores:[0,0,0,0],kongLedger:[],passedHu:[false,false,false,false],settled:false }
}
const tileSuit=(tile:Tile)=>Math.floor(tileType(tile)/9)
export function variantWinning(state:Pick<MahjongState,'variant'|'missing'|'melds'>,seat:SeatId,hand:Tile[]):boolean{
  const open=state.melds[seat],all=[...hand,...open.flatMap(m=>m.tiles)]
  if(isSichuan(state.variant)&&(all.some(t=>tileType(t)>=27||tileSuit(t)===state.missing[seat])||new Set(all.map(tileSuit)).size>2))return false
  const counts=countsOf(hand)
  if(state.variant!=='basic'&&!open.length&&hand.length===14&&counts.every(n=>n%2===0))return true
  return isWinning(hand,open.length)
}
export function mahjongCanHu(state:MahjongState,seat:SeatId):boolean{
  if(state.phase!=='discard'||state.turn!==seat||state.drawn===null||state.finished.includes(seat))return false
  if(state.variant==='bloodflow'&&!state.rivers.some(r=>r.length))return false
  return variantWinning(state,seat,state.hands[seat])
}
export function legalDiscards(state:MahjongState,seat:SeatId):Tile[]{
  if(state.phase!=='discard'||state.turn!==seat)return []
  if(state.variant==='bloodflow'&&state.wins.some(w=>w.seat===seat))return state.drawn===null?[]:[state.drawn]
  const missing=state.hands[seat].filter(t=>tileSuit(t)===state.missing[seat])
  return isSichuan(state.variant)&&missing.length?missing:[...state.hands[seat]]
}
export function claimsFor(state: MahjongState, seat: SeatId): Claim[] {
  const p = state.pending
  if (!p || seat === p.from || state.finished.includes(seat)) return []
  const hand = state.hands[seat], type = tileType(p.tile), claims: Claim[] = []
  if ((state.variant!=='guangdong'||p.rob!==null)&&!state.passedHu[seat]&&variantWinning(state,seat,[...hand,p.tile])) claims.push({ kind: 'hu', tiles: [] })
  if (p.rob !== null) return claims
  if(state.variant==='bloodflow'&&state.wins.some(w=>w.seat===seat))return claims
  if(isSichuan(state.variant)&&tileSuit(p.tile)===state.missing[seat])return claims
  const same = hand.filter(t => tileType(t) === type)
  if (same.length >= 3 && state.wall.length) claims.push({ kind: 'gang', tiles: same.slice(0, 3) })
  if (same.length >= 2) claims.push({ kind: 'peng', tiles: same.slice(0, 2) })
  if (state.variant==='basic' && seat === nextSeat(p.from) && type < 27) for (let start = type - 2; start <= type; start++) {
    if (start < 0 || Math.floor(start / 9) !== Math.floor(type / 9) || start % 9 > 6) continue
    const required = [start, start + 1, start + 2].filter(t => t !== type)
    const tiles = required.map(t => hand.find(tile => tileType(tile) === t))
    if (tiles.every(t => t !== undefined)) claims.push({ kind: 'chi', tiles: tiles as Tile[] })
  }
  return claims
}
export function kongOptions(state: MahjongState, seat: SeatId): MahjongAction[] {
  if (state.phase !== 'discard' || state.turn !== seat || !state.wall.length || state.drawn === null) return []
  const hand = state.hands[seat], counts = countsOf(hand), actions: MahjongAction[] = []
  if(state.variant==='bloodflow'&&state.wins.some(w=>w.seat===seat))return []
  counts.forEach((n, t) => { if (n === 4&&(!isSichuan(state.variant)||Math.floor(t/9)!==state.missing[seat])) actions.push({ kind: 'concealed', tile: hand.find(tile => tileType(tile) === t)! }) })
  state.melds[seat].forEach(m => { if (m.kind === 'peng') { const tile = hand.find(t => tileType(t) === tileType(m.tiles[0])); if (tile !== undefined) actions.push({ kind: 'add', tile }) } })
  return actions
}
export function revealedMahjongHand(state:MahjongState,seat:SeatId):Tile[]{
  if(!state.wins.some(w=>w.seat===seat))return []
  return state.hands[seat].filter(t=>!(state.variant==='bloodflow'&&state.turn===seat&&state.drawn===t))
}
export function observeMahjong(state: MahjongState, seat: SeatId): MahjongObservation {
  return {
    hand: [...state.hands[seat]], seat, melds: structuredClone(state.melds[seat]),
    publicTiles: [...state.rivers.flat(),...state.wonTiles,...state.hands.flatMap((_,p)=>p!==seat?revealedMahjongHand(state,p as SeatId):[]), ...state.melds.flatMap((ms, p) => ms.flatMap(m => m.kind === 'concealed' && p !== seat ? [] : m.tiles))],
    wallCount: state.wall.length, phase: state.phase, claims: state.phase === 'claims' ? claimsFor(state, seat) : [],
    canHu: mahjongCanHu(state,seat), kongs: kongOptions(state, seat),variant:state.variant,missing:state.missing[seat],legalDiscards:legalDiscards(state,seat),locked:state.variant==='bloodflow'&&state.wins.some(w=>w.seat===seat)
  }
}
function transfer(state:MahjongState,from:SeatId,to:SeatId,value:number){state.scores[from]-=value;state.scores[to]+=value}
function activeSeats(state:MahjongState){return ([0,1,2,3] as SeatId[]).filter(s=>!state.finished.includes(s))}
function nextActive(state:MahjongState,seat:SeatId){let next=nextSeat(seat);while(state.finished.includes(next))next=nextSeat(next);return next}
export function mahjongValue(state:Pick<MahjongState,'variant'|'melds'>,seat:SeatId,hand:Tile[]):{value:number;label:string}{
  const c=countsOf(hand),all=[...hand,...state.melds[seat].flatMap(m=>m.tiles)],total=countsOf(all),labels:string[]=[]
  const seven=!state.melds[seat].length&&hand.length===14&&c.every(n=>n%2===0),pure=new Set(all.map(tileSuit)).size===1&&all.every(t=>tileType(t)<27)
  const triplets=!seven&&state.melds[seat].every(m=>m.kind!=='chi')&&c.filter(n=>n%3===2).length===1&&c.every(n=>n%3===0||n%3===2)
  let fan=0;if(seven){fan+=2;labels.push('七对')}if(triplets){fan++;labels.push('碰碰胡')}if(pure){fan+=2;labels.push('清一色')}
  if(isSichuan(state.variant)){const roots=total.filter(n=>n===4).length;if(roots){fan+=roots;labels.push(`${roots} 根`)}if(hand.length===2){fan++;labels.push('金钩钓')}}
  return {value:2**Math.min(4,fan),label:labels.join(' · ')||'平胡'}
}
function payKong(state:MahjongState,seat:SeatId,kind:'concealed'|'add'|'gang',from?:SeatId){
  if(state.variant==='basic')return
  const payers=kind==='gang'?[from!]:activeSeats(state).filter(p=>p!==seat),value=kind==='add'?1:2
  for(const p of payers){transfer(state,p,seat,value);state.kongLedger.push({from:p,to:seat,value,refunded:false})}
}
function waitingValue(state:MahjongState,seat:SeatId){
  const hand=state.hands[seat],all=countsOf([...hand,...state.melds[seat].flatMap(m=>m.tiles)])
  let max=0;for(let t=0;t<(isSichuan(state.variant)?27:34);t++)if(all[t]<4&&variantWinning(state,seat,[...hand,t*4]))max=Math.max(max,mahjongValue(state,seat,[...hand,t*4]).value)
  return max
}
export function finishMahjongWall(state:MahjongState){
  if(state.settled)return
  state.phase='finished';state.reason='流局';state.winner=null;state.pending=null;state.settled=true
  if(isSichuan(state.variant)){
    const active=activeSeats(state),flowers=active.filter(s=>state.hands[s].some(t=>tileSuit(t)===state.missing[s])),ready=active.map(seat=>({seat,value:waitingValue(state,seat)}))
    for(const from of flowers)for(const to of ([0,1,2,3] as SeatId[]).filter(s=>s!==from&&!flowers.includes(s)))transfer(state,from,to,16)
    for(const loser of ready.filter(r=>!r.value&&!flowers.includes(r.seat)))for(const winner of ready.filter(r=>r.value&&!flowers.includes(r.seat)))transfer(state,loser.seat,winner.seat,winner.value)
    const refund=ready.filter(r=>!r.value).map(r=>r.seat)
    for(const kong of state.kongLedger)if(refund.includes(kong.to)&&!kong.refunded){transfer(state,kong.to,kong.from,kong.value);kong.refunded=true}
    state.reason='牌墙已空 · 已查花猪、查叫与退税'
  }
}
function recordWin(state:MahjongState,seat:SeatId,tile:Tile,from:SeatId|null,rob=false){
  const hand=from===null?[...state.hands[seat]]:[...state.hands[seat],tile],score=mahjongValue(state,seat,hand)
  const payers=from===null?activeSeats(state).filter(p=>p!==seat):[from]
  let value=score.value+(from===null?1:0)
  if(state.variant==='guangdong'&&rob)value*=3
  for(const p of payers)transfer(state,p,seat,value)
  state.wins.push({seat,from,tile,hand,value:score.value,label:`${rob?'抢杠胡':from===null?'自摸':'点炮胡'} · ${score.label}`})
  if(state.variant==='sichuan')state.finished.push(seat)
}
function draw(state: MahjongState, seat: SeatId, replacement = false) {
  if (!state.wall.length) { finishMahjongWall(state); return }
  const tile = replacement ? state.wall.pop()! : state.wall.shift()!
  state.turn = seat; state.phase = 'discard'; state.drawn = tile; state.pending = null
  state.hands[seat] = sortTiles(state.hands[seat]); state.hands[seat].push(tile)
  state.passedHu[seat]=false
}
function advanceClaims(state: MahjongState) {
  const p = state.pending!
  for (let n = 1; n < 4; n++) {
    const seat = ((p.from + n) % 4) as SeatId
    if (!p.replies.some(r => r.seat === seat) && claimsFor(state, seat).length) { state.turn = seat; return }
  }
  const priority = { hu: 3, gang: 2, peng: 2, chi: 1, pass: 0 }
  const winners = p.replies.filter(r => r.action.kind !== 'pass').sort((a, b) => priority[b.action.kind] - priority[a.action.kind] || (a.seat - p.from + 4) % 4 - (b.seat - p.from + 4) % 4)
  const chosen = winners[0]
  if (chosen?.action.kind === 'hu') {
    if(state.variant!=='basic'){
      const hu=isSichuan(state.variant)?winners.filter(r=>r.action.kind==='hu'):[chosen]
      for(const r of hu)recordWin(state,r.seat,p.tile,p.from,p.rob!==null)
      if(state.variant==='guangdong'){state.phase='finished';state.winner=chosen.seat;state.turn=chosen.seat;state.reason='抢杠胡';state.drawn=null;return}
      if(p.rob!==null){state.hands[p.from]=state.hands[p.from].filter(t=>t!==p.tile);state.wonTiles.push(p.tile)}
      state.pending=null;state.drawn=null
      if(state.finished.length>=3){state.phase='finished';state.reason='三家已胡';state.winner=state.finished[0];return}
      draw(state,nextActive(state,hu.at(-1)!.seat));return
    }
    state.phase = 'finished'; state.winner = chosen.seat; state.turn = chosen.seat
    state.reason = p.rob !== null ? '抢杠和' : '荣和'; state.drawn = null; return
  }
  if (p.rob !== null) {
    const meld = state.melds[p.from][p.rob]; meld.kind = 'gang'; meld.tiles.push(p.tile)
    state.hands[p.from] = state.hands[p.from].filter(t => t !== p.tile)
    payKong(state,p.from,'add')
    draw(state, p.from, true); return
  }
  if (!chosen) { draw(state, nextActive(state,p.from)); return }
  const { seat, action } = chosen
  state.hands[seat] = sortTiles(state.hands[seat].filter(t => !action.tiles.includes(t)))
  state.melds[seat].push({ kind: action.kind as Meld['kind'], tiles: sortTiles([...action.tiles, p.tile]), from: p.from })
  state.rivers[p.from].pop(); state.turn = seat; state.pending = null; state.drawn = null; state.phase = 'discard'
  if (action.kind === 'gang') {payKong(state,seat,'gang',p.from);draw(state, seat, true)}
}
function claimEqual(a: Claim, b: Claim) { return a.kind === b.kind && [...a.tiles].sort((x, y) => x - y).join(',') === [...b.tiles].sort((x, y) => x - y).join(',') }
export function actMahjong(state: MahjongState, seat: SeatId, action: MahjongAction): { state: MahjongState; error?: string } {
  const invalid = (error: string) => ({ state, error })
  if (state.phase === 'finished' || state.turn !== seat) return invalid('还没轮到你')
  const s = structuredClone(state)
  if(s.phase==='exchange'){
    if(action.kind!=='exchange'||action.tiles.length!==3||new Set(action.tiles).size!==3||action.tiles.some(t=>!s.hands[seat].includes(t))||new Set(action.tiles.map(tileSuit)).size!==1)return invalid('请选择 3 张同花色的牌')
    s.exchanges[seat]=[...action.tiles];s.step++
    if(s.exchanges.every(Boolean)){
      const before=structuredClone(s.hands)
      for(let p=0;p<4;p++)s.hands[p]=sortTiles([...before[p].filter(t=>!s.exchanges[p]!.includes(t)),...s.exchanges[(p+3)%4]!])
      s.phase='missing';s.turn=0;s.drawn=s.hands[0].at(-1)!
    }else s.turn=nextSeat(seat)
    return {state:s}
  }
  if(s.phase==='missing'){
    if(action.kind!=='missing'||![0,1,2].includes(action.suit))return invalid('请选择万、筒、条中的一门定缺')
    s.missing[seat]=action.suit;s.step++;if(s.missing.every(n=>n!==null)){s.phase='discard';s.turn=0}else s.turn=nextSeat(seat)
    return {state:s}
  }
  if (s.phase === 'claims') {
    if (!('tiles' in action) || action.kind==='exchange' || action.kind !== 'pass' && !claimsFor(s, seat).some(c => claimEqual(c, action as Claim))) return invalid('当前不能这样鸣牌')
    if(isSichuan(s.variant)&&action.kind!=='hu'&&claimsFor(s,seat).some(c=>c.kind==='hu'))s.passedHu[seat]=true
    s.pending!.replies.push({ seat, action }); s.step++; advanceClaims(s); return { state: s }
  }
  if (action.kind === 'hu') {
    if (!mahjongCanHu(s,seat)) return invalid('还没有和牌')
    if(s.variant!=='basic'){
      const tile=s.drawn!;recordWin(s,seat,tile,null);s.step++
      if(s.variant==='guangdong'){s.phase='finished';s.winner=seat;s.reason='自摸';return {state:s}}
      if(s.variant==='bloodflow'){s.hands[seat]=s.hands[seat].filter(t=>t!==tile);s.wonTiles.push(tile)}
      if(s.finished.length>=3){s.phase='finished';s.reason='三家已胡';s.winner=s.finished[0];return {state:s}}
      draw(s,nextActive(s,seat));return {state:s}
    }
    s.phase = 'finished'; s.winner = seat; s.reason = '自摸'; s.step++; return { state: s }
  }
  if (action.kind === 'discard') {
    if (!legalDiscards(s,seat).includes(action.tile)) return invalid(s.variant==='bloodflow'&&s.wins.some(w=>w.seat===seat)?'胡牌后锁手，请打出刚摸的牌':'必须先打定缺花色的牌')
    s.hands[seat] = sortTiles(s.hands[seat].filter(t => t !== action.tile)); s.rivers[seat].push(action.tile)
    s.last = { seat, tile: action.tile }; s.drawn = null; s.phase = 'claims'
    s.pending = { tile: action.tile, from: seat, rob: null, replies: [] }; s.step++; advanceClaims(s); return { state: s }
  }
  if (action.kind === 'concealed' || action.kind === 'add') {
    if (!kongOptions(s, seat).some(a => a.kind === action.kind && 'tile' in a && a.tile === action.tile)) return invalid('当前不能杠牌')
    if (action.kind === 'concealed') {
      const tiles = s.hands[seat].filter(t => tileType(t) === tileType(action.tile))
      s.melds[seat].push({ kind: 'concealed', tiles, from: seat }); s.hands[seat] = s.hands[seat].filter(t => !tiles.includes(t)); draw(s, seat, true)
      payKong(s,seat,'concealed')
    } else {
      const index = s.melds[seat].findIndex(m => m.kind === 'peng' && tileType(m.tiles[0]) === tileType(action.tile))
      s.pending = { tile: action.tile, from: seat, rob: index, replies: [] }; s.phase = 'claims'; s.drawn = null; advanceClaims(s)
    }
    s.step++; return { state: s }
  }
  return invalid('请选择要打出的牌')
}

function shapeValue(hand: Tile[]) {
  const counts = countsOf(hand)
  return hand.reduce((sum, tile) => {
    const t = tileType(tile)
    return sum + counts[t] * 3 + (t < 27 ? [t - 2, t - 1, t + 1, t + 2].filter(n => n >= 0 && n < 27 && Math.floor(n / 9) === Math.floor(t / 9)).reduce((n, i) => n + counts[i] * (Math.abs(t - i) === 1 ? 1.5 : .5), 0) : 0)
  }, 0)
}
export function chooseMahjong(o: MahjongObservation, level: Level, random = Math.random): MahjongAction {
  if(o.phase==='exchange'){
    const suits=[0,1,2].map(suit=>o.hand.filter(t=>tileSuit(t)===suit)).filter(h=>h.length>=3).sort((a,b)=>a.length-b.length)
    return {kind:'exchange',tiles:[...suits[0]].sort((a,b)=>shapeValue(suits[0].filter(t=>t!==b))-shapeValue(suits[0].filter(t=>t!==a))).slice(0,3)}
  }
  if(o.phase==='missing')return {kind:'missing',suit:[0,1,2].sort((a,b)=>o.hand.filter(t=>tileSuit(t)===a).length-o.hand.filter(t=>tileSuit(t)===b).length)[0]}
  if (o.phase === 'claims') {
    const hu = o.claims.find(c => c.kind === 'hu'); if (hu) return hu
    if (level === 0 || !o.claims.length) return { kind: 'pass', tiles: [] }
    const current = shanten(o.hand, o.melds.length)
    const candidates = o.claims.map(claim => {
      const rest = o.hand.filter(t => !claim.tiles.includes(t))
      return { claim, score: shanten(rest, o.melds.length + 1) }
    }).sort((a, b) => a.score - b.score)
    return candidates[0].score < current || candidates[0].claim.kind === 'gang' ? candidates[0].claim : { kind: 'pass', tiles: [] }
  }
  if (o.canHu) return { kind: 'hu', tiles: [] }
  if (o.kongs.length && level > 0) return o.kongs[0]
  const allowed=o.legalDiscards,unique = allowed.filter((t, i, all) => all.findIndex(x => tileType(x) === tileType(t)) === i)
  if (level === 0) return { kind: 'discard', tile: unique[Math.floor(random() * unique.length)] }
  const known = countsOf([...o.hand, ...o.publicTiles]), cache = new Map<string, number>()
  const distance = (hand: Tile[]) => { const key = countsOf(hand).join(''); if (!cache.has(key)) cache.set(key, shanten(hand, o.melds.length)); return cache.get(key)! }
  const options = unique.map(tile => {
    const rest = o.hand.filter(t => t !== tile), d = level >= 2 ? distance(rest) : 0
    let improvement = 0
    if (level >= 3) for (let t = 0; t < (isSichuan(o.variant)?27:34); t++) {
      if(isSichuan(o.variant)&&Math.floor(t/9)===o.missing)continue
      if (known[t] >= 4) continue
      if (distance([...rest, t * 4]) < d) improvement += 4 - known[t]
    }
    return { tile, value: d * 1000 - improvement * (level === 4 ? 15 : 10) - shapeValue(rest) }
  }).sort((a, b) => a.value - b.value)
  return { kind: 'discard', tile: options[0].tile }
}
