import test from 'node:test'
import assert from 'node:assert/strict'
import {analyze} from '../ui/ai.ts'
import {createGame,play,hash} from '../ui/game.ts'
function seeded(seed=73){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
test('Gomoku levels 1–4 take a win and block an immediate loss',()=>{
  for(let level=1;level<=4;level++)for(const color of [1,2]){
    const s=createGame('gomoku');s.turn=color
    for(let x=3;x<7;x++)s.board[7*15+x]=color
    let a=analyze(s,level,seeded(),100)
    assert.equal(play(s,a.move).state.winner,color)
    s.board.fill(0);s.board[7*15+2]=color
    for(let x=3;x<7;x++)s.board[7*15+x]=color===1?2:1
    a=analyze(s,level,seeded(),100);assert.equal(a.move,7*15+7)
  }
})
test('All levels produce legal Go moves on both supported sizes; suggestions are legal',()=>{
  for(const size of [9,19])for(let level=0;level<=4;level++){
    let s=createGame('go',size);s=play(s,Math.floor(size*size/2)).state
    const a=analyze(s,level,seeded(),50)
    assert.equal(play(s,a.move).error,undefined)
    for(const c of a.suggestions)assert.equal(play(s,c.point).error,undefined)
    assert.ok(a.blackWinrate>=0&&a.blackWinrate<=100)
  }
})
test('Go search recognizes an immediate capture and never suggests ko recapture',()=>{
  const s=createGame('go');s.board[40]=2;[31,39,41].forEach(p=>s.board[p]=1);s.hashes=[hash(s.board)]
  assert.equal(analyze(s,1,seeded(),50).move,49)
  const ko=createGame('go');[9,1,11].forEach(p=>ko.board[p]=1);[10,18,20,28].forEach(p=>ko.board[p]=2);ko.hashes=[hash(ko.board)]
  const p=play(ko,19).state,a=analyze(p,2,seeded(),50)
  assert.notEqual(a.move,10);assert.ok(!a.suggestions.some(c=>c.point===10))
})
test('Seeded 9x9 self-play remains legal through 80 half-moves or scoring',()=>{
  let s=createGame('go');const rng=seeded()
  for(let i=0;i<80&&s.phase==='playing';i++){
    const a=analyze(s,1,rng,30),next=play(s,a.move)
    assert.equal(next.error,undefined,`half-move ${i}`);s=next.state
  }
  assert.ok(s.moves.length>10)
})
