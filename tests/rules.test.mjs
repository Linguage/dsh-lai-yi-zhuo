import test from 'node:test'
import assert from 'node:assert/strict'
import {createGame,play,groupAt,placeGo,hash,lineAt,areaScore,finishScore,resign} from '../ui/game.ts'
import {restore,encode,readPreferences} from '../ui/storage.ts'
test('Gomoku alternates turns and rejects an occupied point without mutating',()=>{
  const a=createGame('gomoku'),b=play(a,112).state
  assert.equal(a.board[112],0);assert.equal(b.turn,2);assert.equal(b.board[112],1)
  assert.equal(play(b,112).state,b);assert.ok(play(b,112).error)
  for(const p of [-1,225,1.5,NaN]) assert.ok(play(b,p).error)
  assert.ok(play(b,null).error)
})
test('Gomoku wins along all four axes, allows six-in-a-row and never wraps edges',()=>{
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    const s=createGame('gomoku'),start=dy===-1?8*15+4:4*15+4
    for(let i=0;i<4;i++)s.board[start+i*(dx+dy*15)]=1
    const t=play(s,start+4*(dx+dy*15)).state
    assert.equal(t.phase,'finished');assert.equal(t.winner,1);assert.equal(t.winningLine.length,5)
    assert.ok(play(t,0).error)
  }
  const s=createGame('gomoku');[105,106,108,109,110].forEach(p=>s.board[p]=1)
  assert.equal(play(s,107).state.winningLine.length,6)
  const b=Array(225).fill(0);[13,14,15,16,17].forEach(p=>b[p]=1)
  assert.deepEqual(lineAt(b,15,15),[])
})
test('A full Gomoku board without five is a draw',()=>{
  const s=createGame('gomoku')
  for(let y=0;y<15;y++)for(let x=0;x<15;x++)s.board[y*15+x]=(Math.floor(x/2)+y)%2+1
  const c=s.board[224];s.board[224]=0;s.turn=c
  const t=play(s,224).state
  assert.equal(t.phase,'finished');assert.equal(t.winner,0)
})
test('Go shared liberties, capture and suicide',()=>{
  const s=createGame('go');s.board[40]=2;[31,39,41].forEach(p=>s.board[p]=1)
  s.hashes=[hash(s.board)]
  const t=play(s,49).state
  assert.equal(t.board[40],0);assert.deepEqual(t.captures,[1,0]);assert.equal(s.board[40],2)
  assert.ok(play(t,40).error)
  const b=Array(81).fill(0);b[40]=b[41]=1
  assert.equal(groupAt(b,40,9).stones.size,2);assert.equal(groupAt(b,40,9).liberties.size,6)
})
test('Go captures before checking own liberties',()=>{
  const b=Array(81).fill(0)
  b[40]=2;[31,39,41].forEach(p=>b[p]=1);[48,50,58].forEach(p=>b[p]=2)
  const r=placeGo(b,9,49,1)
  assert.equal(r.error,undefined);assert.deepEqual(r.captured,[40]);assert.equal(groupAt(r.board,49,9).liberties.size,1)
})
test('Go positional superko blocks immediate recapture and any earlier repeated board',()=>{
  const s=createGame('go')
  ;[9,1,11].forEach(p=>s.board[p]=1);[10,18,20,28].forEach(p=>s.board[p]=2);s.hashes=[hash(s.board)]
  const t=play(s,19);assert.equal(t.error,undefined);assert.equal(t.state.board[10],0)
  assert.match(play(t.state,10).error,/重复/)
  const b=Array(81).fill(0),after=b.slice();after[40]=1
  assert.match(placeGo(b,9,40,1,['unrelated',hash(after)]).error,/重复/)
})
test('Go two passes enter scoring; scores use area, neutral space and komi',()=>{
  const s=createGame('go'),a=play(s,null).state,b=play(a,null).state
  assert.equal(b.phase,'scoring');assert.equal(b.moves.length,2);assert.ok(play(b,40).error)
  assert.equal(areaScore(b).black,0);assert.equal(areaScore(b).white,0);assert.equal(areaScore(b).winner,2)
  const x=createGame('go');x.board[0]=1;x.board[80]=2
  let score=areaScore(x);assert.equal(score.black,1);assert.equal(score.white,1);assert.equal(score.margin,-7.5)
  x.board.fill(1);x.board[40]=0
  score=areaScore(x);assert.equal(score.black,81);assert.equal(score.margin,73.5)
  x.board[40]=2
  assert.equal(areaScore(x,[40]).black,81);assert.equal(x.board[40],2)
  assert.equal(finishScore(b,[]).phase,'finished')
})
test('Session persistence replays moves and rejects corrupted records',()=>{
  let position=createGame('go');position=play(position,40).state;position=play(position,41).state
  const s={position,history:[],human:1,level:2,dead:[]},result=restore(encode(s))
  assert.deepEqual(result.position.board,position.board);assert.equal(result.history.length,2)
  assert.equal(restore('{bad'),null);assert.equal(restore(encode({...s,human:3})),null)
  const bad=JSON.parse(encode(s));bad.position.moves[1].point=40
  assert.equal(restore(JSON.stringify(bad)),null)
  const finished=restore(encode({...s,position:resign(position,1)}))
  assert.equal(finished.position.winner,2);assert.equal(finished.position.phase,'finished')
  assert.deepEqual(readPreferences('{}'),{winrate:false,suggestions:false,sound:true})
})
test('Resuming after scoring retains next turn and positional superko history',()=>{
  let p=createGame('go');p=play(p,40).state;p=play(p,null).state;p=play(p,null).state
  p={...p,phase:'playing',passes:0,reason:''};p=play(p,41).state
  const s=restore(encode({position:p,history:[],human:2,level:4,dead:[]}))
  assert.deepEqual(s.position,p)
})
