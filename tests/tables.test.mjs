import test from 'node:test'
import assert from 'node:assert/strict'
import { createCards, classify, beats, cardRank, chooseCards, observeCards, playCards, legalCardMoves } from '../ui/guandan.ts'
import { createMahjong, isWinning, shanten, claimsFor, actMahjong, chooseMahjong, observeMahjong, kongOptions } from '../ui/mahjong.ts'
import { newTable, seeded, tableAct, undoTable, encodeTable, restoreTable } from '../ui/table-session.ts'

const card = (rank, suit = 0, copy = 0) => copy * 54 + (rank >= 16 ? rank + 36 : suit * 13 + rank - 2)
const copies = (rank, n) => Array.from({length:n}, (_, i) => card(rank, i % 4, Math.floor(i / 4)))
const shape = (cards, kind) => classify(cards).find(m => m.kind === kind)
const tiles = types => { const used = new Map(); return types.map(t => { const n = used.get(t) || 0; assert(n < 4); used.set(t, n + 1); return t * 4 + n }) }
const winningTypes = [0,1,2,3,4,5,9,10,11,18,19,20,27,27]
function mjFixture(hands, turn = 0) {
  const s = createMahjong(seeded(1)), used = new Map()
  s.hands = hands.map(hand => hand.map(t => { const n = used.get(t) || 0; assert(n < 4, `too many ${t}`); used.set(t,n+1); return t*4+n }))
  s.wall = Array.from({length:136},(_,i)=>i).filter(t=>!s.hands.flat().includes(t));s.turn=turn;s.drawn=s.hands[turn].at(-1)
  return s
}

test('Guandan deal, wildcards, ace sequences and rank comparisons', () => {
  const state = createCards(seeded(1)); assert.deepEqual(state.hands.map(h=>h.length),[27,27,27,27]);assert.equal(new Set(state.hands.flat()).size,108)
  const wild=card(2,1)
  assert(shape([card(3),card(4),wild,card(6),card(7)],'straight'))
  assert.equal(shape([card(14),card(2),card(3),card(4),card(5)],'straight').rank,5)
  assert.equal(shape([card(12),card(12,2),card(13),card(13,2),card(14),card(14,2)],'pairs').rank,14)
  assert.equal(shape([card(14),card(14,2),card(2),card(2,2),card(3),card(3,2)],'pairs').rank,3)
  assert.equal(classify([card(12),card(13),card(14),card(2),card(3)]).length,0)
  assert.equal(classify([card(17),wild]).length,0)
  assert.equal(classify([card(3),card(3)]).length,0)
  assert(beats(shape([card(2)],'single'),shape([card(14)],'single')))
  assert(!beats(shape([card(2)],'single'),shape([card(16)],'single')))
})
test('Guandan bombs, straight flush, four jokers and wildcard interpretations', () => {
  const b4=shape(copies(3,4),'bomb'),b5=shape(copies(3,5),'bomb'),b6=shape(copies(3,6),'bomb')
  const flush=shape([3,4,5,6,7].map(r=>card(r,2)),'flush'), jokers=shape([card(16),card(17),card(16,0,1),card(17,0,1)],'jokers')
  assert(beats(b5,b4));assert(beats(flush,b5));assert(beats(b6,flush));assert(beats(jokers,b6));assert(!beats(flush,b6))
  assert(shape([...copies(3,8),card(2,1),card(2,1,1)],'bomb'))
  const interpretations=classify([card(3),card(3,2),card(4),card(4,2),card(2,1)]).filter(m=>m.kind==='full')
  assert.deepEqual(interpretations.map(m=>m.rank),[3,4])
})
test('Guandan pass, partner relay, ended-player skipping, illegal actions are immutable', () => {
  let s=createCards(seeded(1));s.hands=[[card(3)],[card(4)],[card(5)],[card(6)]]
  const before=structuredClone(s);assert(playCards(s,0,null).error);assert.deepEqual(s,before)
  s=playCards(s,0,[card(3)]).state;assert.equal(s.turn,1);assert.deepEqual(s.order,[0])
  for(const p of [1,2,3])s=playCards(s,p,null).state
  assert.equal(s.turn,2);assert.equal(s.last,null);assert.equal(s.message,'接风')
  s=playCards(s,2,[card(5)]).state;assert.equal(s.turn,3)
  s=playCards(s,3,[card(6)]).state;assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.deepEqual(s.order,[0,2,3,1])
})
test('Mahjong standard, seven pairs, thirteen orphans, open hands and distance', () => {
  const win=tiles(winningTypes);assert(isWinning(win));assert.equal(shanten(win),-1)
  assert.equal(shanten(win.slice(0,-1)),0);assert(!isWinning(win.slice(0,-1)))
  assert(isWinning(tiles([0,0,4,4,9,9,13,13,18,18,27,27,31,31])))
  assert(!isWinning(tiles([0,0,0,0,4,4,9,9,18,18,27,27,31,31])))
  assert(isWinning(tiles([0,8,9,17,18,26,27,28,29,30,31,32,33,33])))
  assert(isWinning(tiles(winningTypes.slice(3)),1))
  assert(!isWinning(tiles([0,1,2,7,8,9,18,19,20,27,27,27,31,31])))
})
test('Mahjong chi only next seat, claims consume physical tiles and hand returns to discard', () => {
  let s=mjFixture([[4],[3,5,10,12],[3,5,17],[4,4,22]])
  const discarded=s.hands[0][0];s=actMahjong(s,0,{kind:'discard',tile:discarded}).state
  assert(claimsFor(s,1).some(c=>c.kind==='chi'));assert(!claimsFor(s,2).some(c=>c.kind==='chi'));assert(claimsFor(s,3).some(c=>c.kind==='peng'))
  const chi=claimsFor(s,1).find(c=>c.kind==='chi');s=actMahjong(s,1,chi).state
  const peng=claimsFor(s,3).find(c=>c.kind==='peng');s=actMahjong(s,3,peng).state
  assert.equal(s.turn,3);assert.equal(s.phase,'discard');assert.equal(s.melds[3][0].kind,'peng');assert.equal(s.rivers[0].length,0);assert.equal(s.hands[3].length,1);assert.equal(s.drawn,null)
})
test('Mahjong winning claim outranks peng, multi-winner priority follows turn order', () => {
  let s=mjFixture([[27],winningTypes.slice(0,-1),[27,27],[]])
  s=actMahjong(s,0,{kind:'discard',tile:s.hands[0][0]}).state
  assert.equal(s.turn,1);s=actMahjong(s,1,{kind:'hu',tiles:[]}).state
  s=actMahjong(s,2,claimsFor(s,2).find(c=>c.kind==='peng')).state
  assert.equal(s.phase,'finished');assert.equal(s.winner,1);assert.equal(s.reason,'荣和')
  s=mjFixture([[27],winningTypes.slice(0,-1),winningTypes.slice(0,-1),[]])
  s=actMahjong(s,0,{kind:'discard',tile:s.hands[0][0]}).state
  s=actMahjong(s,1,{kind:'hu',tiles:[]}).state;s=actMahjong(s,2,{kind:'hu',tiles:[]}).state
  assert.equal(s.winner,1)
})
test('Mahjong concealed kong draws from wall tail; added kong can be robbed', () => {
  let s=mjFixture([[0,0,0,0,4,6,8,12,15,18,21,25,30,32],[],[],[]])
  const tail=s.wall.at(-1),options=kongOptions(s,0);assert.equal(options[0].kind,'concealed')
  s=actMahjong(s,0,options[0]).state;assert.equal(s.drawn,tail);assert.equal(s.melds[0][0].tiles.length,4);assert.equal(s.hands[0].length,11)
  // A robbed kong wait needs no fourth copy in the claimant's hand: use sequence 0-1-2.
  s=mjFixture([[0],[1,2,3,4,5,9,10,11,18,19,20,27,27],[],[]])
  s.melds[0]=[{kind:'peng',tiles:[1,2,3],from:1}];s.wall=s.wall.filter(t=>![1,2,3].includes(t))
  const tile=s.hands[0][0];s=actMahjong(s,0,{kind:'add',tile}).state
  assert.equal(s.phase,'claims');assert.equal(s.turn,1);assert(claimsFor(s,1).some(c=>c.kind==='hu'))
  s=actMahjong(s,1,{kind:'hu',tiles:[]}).state;assert.equal(s.reason,'抢杠和');assert.equal(s.melds[0][0].kind,'peng')
})
test('Mahjong empty wall, invalid claim, direct discard and self draw', () => {
  let s=mjFixture([[31],[],[],[]]);s.wall=[]
  assert(actMahjong(s,0,{kind:'hu',tiles:[]}).error)
  s=actMahjong(s,0,{kind:'discard',tile:s.hands[0][0]}).state;assert.equal(s.phase,'finished');assert.equal(s.reason,'流局')
  s=mjFixture([winningTypes,[],[],[]]);s=actMahjong(s,0,{kind:'hu',tiles:[]}).state;assert.equal(s.winner,0);assert.equal(s.reason,'自摸')
})

function aiAction(state, level) {
  if(state.kind==='guandan'){const m=chooseCards(observeCards(state,state.turn),level,seeded(state.step+100));return {game:'guandan',cards:m?.cards??null,shapeKey:m?.key}}
  return {game:'mahjong',action:chooseMahjong(observeMahjong(state,state.turn),level,seeded(state.step+100))}
}
test('Both engines finish complete games at every difficulty, preserving physical card inventory', () => {
  for(const kind of ['guandan','mahjong'])for(const level of [0,1,2,3,4])for(const seed of [17,88]){
    let s=newTable(kind,level,seed),n=0
    while(s.state.phase!=='finished'&&n++<1200){
      const state=s.state,result=tableAct(s,state.turn,aiAction(state,level));assert(!result.error,JSON.stringify(result.error));s=result.session
      const all=kind==='guandan'?[...s.state.hands.flat(),...s.state.played]:[...s.state.hands.flat(),...s.state.wall,...s.state.rivers.flat(),...s.state.melds.flat().flatMap(m=>m.tiles)]
      assert.equal(all.length,kind==='guandan'?108:136);assert.equal(new Set(all).size,all.length)
    }
    assert.equal(s.state.phase,'finished',`${kind} level ${level} did not finish`)
    assert.deepEqual(restoreTable(encodeTable(s),kind).state,s.state);assert.equal(encodeTable(restoreTable(encodeTable(s),kind)),encodeTable(s))
  }
})
test('AI observations omit all opponent hands, wall order, concealed kongs and pending replies', () => {
  const cards=createCards(seeded(1)),o=observeCards(cards,0)
  assert(!('hands'in o));assert(!('wall'in o));assert.deepEqual(o.hand,cards.hands[0]);o.hand.pop();assert.equal(cards.hands[0].length,27)
  const s=createMahjong(seeded(1));s.melds[1]=[{kind:'concealed',tiles:[0,1,2,3],from:1}]
  const m=observeMahjong(s,0);assert(!('wall'in m));assert(!('hands'in m));assert(!('pending'in m));assert.deepEqual(m.publicTiles,[])
})
test('Replay persistence, per-decision undo depth, reset by valid action and cancelled future', () => {
  for(const kind of ['guandan','mahjong'])for(const level of [0,1,2]){
    let s=newTable(kind,level,612), checkpoints=[]
    while(checkpoints.length<3&&s.state.phase!=='finished'){
      if(s.state.turn===0)checkpoints.push(s)
      s=tableAct(s,s.state.turn,aiAction(s.state,level)).session
      while(s.state.turn!==0&&s.state.phase!=='finished')s=tableAct(s,s.state.turn,aiAction(s.state,level)).session
    }
    assert(checkpoints.length>=2)
    const original=s
    if(level===2){assert.equal(undoTable(s),s);continue}
    s=undoTable(s);assert.deepEqual(s.state,checkpoints.at(-1).state);assert.equal(s.undoStreak,1)
    s=restoreTable(encodeTable(s),kind);assert.equal(s.undoStreak,1)
    if(level===0){s=undoTable(s);assert.deepEqual(s.state,checkpoints.at(-2).state);assert.equal(s.undoStreak,2)}
    assert.equal(undoTable(s),s)
    const invalid=tableAct(s,0,kind==='guandan'?{game:kind,cards:[]}:{game:kind,action:{kind:'discard',tile:999}})
    assert(invalid.error);assert.equal(invalid.session.undoStreak,s.undoStreak)
    s=tableAct(s,0,aiAction(s.state,level)).session;assert.equal(s.undoStreak,0)
    assert(s.actions.length<original.actions.length)
    const encoded=JSON.parse(encodeTable(s));encoded.actions[0].seat=3;assert.equal(restoreTable(JSON.stringify(encoded),kind),null)
  }
})
