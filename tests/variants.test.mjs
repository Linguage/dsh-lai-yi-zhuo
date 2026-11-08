import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess, SQUARES } from 'chess.js'
import { createXiangqi,xqLegal,xqCheck,playXiangqi,royalMoves,royalPosition,actRoyal,undoRoyal,restoreRoyal,analyzeRoyal,chessPosition } from '../ui/royal.ts'
import { createClimb,classifyClimb,climbBeats,actClimb,chooseClimb,observeClimb } from '../ui/climbing.ts'
import { createTractor,tractorPattern,tractorPlayError,trickWinner,actTractor,chooseTractor,observeTractor,category,pointValue } from '../ui/tractor.ts'
import { newCardsSession,actCardsSession,restoreCardsSession,encodeCardsSession,undoCardsSession } from '../ui/cards-session.ts'
import { createMahjong,variantWinning,mahjongCanHu,claimsFor,actMahjong,legalDiscards,chooseMahjong,observeMahjong,finishMahjongWall,kongOptions } from '../ui/mahjong.ts'
import { newTable,seeded,tableAct,encodeTable,restoreTable,undoTable,tableKey } from '../ui/table-session.ts'
const card=(rank,suit=0,copy=0)=>copy*54+(rank>=16?rank+36:suit*13+rank-2)
const copies=(rank,n)=>Array.from({length:n},(_,i)=>card(rank,i%4,Math.floor(i/4)))
const pair=(rank,suit=0)=>[card(rank,suit),card(rank,suit,1)]
function xqFixture(pieces,turn='w'){const s=createXiangqi();s.board.fill(null);for(const [p,i]of pieces)s.board[i]=p;s.turn=turn;s.history=[];return s}
const has=(s,from,to)=>xqLegal(s).some(m=>m.from===from&&m.to===to)
const baseSession=kind=>({kind,human:'w',level:0,moves:[],undoStreak:0})
const chessMove=(a,b,promotion)=>({from:SQUARES.indexOf(a),to:SQUARES.indexOf(b),...(promotion?{promotion}:{})})

test('Xiangqi opening, blocked horse and elephant, cannon screen, river and facing kings',()=>{
 const opening=createXiangqi();assert.equal(xqLegal(opening).length,44)
 let s=xqFixture([['K',85],['k',4],['P',49],['N',64],['P',55]])
 assert(!has(s,64,45));assert(has(s,64,47)===false);assert(has(s,64,57))
 s=xqFixture([['K',85],['k',4],['P',49],['B',65],['P',55]])
 assert(!has(s,65,45));assert(has(s,65,49)===false);assert(has(s,65,81))
 s=xqFixture([['K',85],['k',4],['P',49],['C',63],['P',45],['r',27]])
 assert(has(s,63,54));assert(!has(s,63,45));assert(!has(s,63,36));assert(has(s,63,27))
 s=xqFixture([['K',85],['k',4],['R',49]])
 assert(!has(s,49,48));assert(has(s,49,40));assert(!xqCheck(s.board,'w'));s.board[49]=null;assert(xqCheck(s.board,'w'))
 s=xqFixture([['K',85],['k',4],['P',49],['P',54],['P',36]])
 assert(!has(s,54,55));assert(has(s,36,37));assert(!has(s,36,45))
})
test('Xiangqi stalemate is loss, illegal move immutable and quiet repetition is draw',()=>{
 let s=xqFixture([['K',85],['k',4],['R',22],['R',12],['R',14]])
 const bad=playXiangqi(s,{from:85,to:0});assert.equal(bad,null)
 s=playXiangqi(s,{from:22,to:13});assert.equal(s.phase,'finished');assert.equal(s.winner,'w')
 s=createXiangqi();for(let n=0;n<2;n++)for(const move of [{from:82,to:65},{from:1,to:20},{from:65,to:82},{from:20,to:1}])s=playXiangqi(s,move)
 assert.equal(s.phase,'finished');assert.equal(s.reason,'三次重复和棋')
})
test('Chess integration: castling, en passant, promotion and mate classification',()=>{
 let s=baseSession('chess')
 for(const [a,b]of [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['g8','f6'],['e1','g1']]){s=actRoyal(s,chessMove(a,b));assert(s)}
 assert.equal(royalPosition(s).board[SQUARES.indexOf('f1')],'R');assert.equal(royalPosition(s).board[SQUARES.indexOf('g1')],'K')
 let c=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');c.move('exd6');assert.equal(chessPosition(c).board[SQUARES.indexOf('d5')],null)
 c=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.equal(c.moves({verbose:true}).filter(m=>m.from==='a7').length,4);c.move({from:'a7',to:'a8',promotion:'n'});assert.equal(chessPosition(c).board[0],'N')
 s=baseSession('chess');for(const [a,b]of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']])s=actRoyal(s,chessMove(a,b));assert.equal(royalPosition(s).reason,'将死');assert.equal(royalPosition(s).winner,'b');assert.equal(royalMoves(s).length,0)
})
test('Both chess engines: legal AI at all levels; persisted decision undo resets only on human action',()=>{
 for(const kind of ['xiangqi','chess']){
  let s=baseSession(kind)
  for(const level of [0,1,2,3,4]){const ai=analyzeRoyal(s,level,seeded(17));assert(royalMoves(s).some(m=>JSON.stringify(m)===JSON.stringify(ai.move)));s=actRoyal(s,ai.move)}
  assert.deepEqual(restoreRoyal(JSON.stringify(s),kind),s);s=undoRoyal(s);assert.equal(s.moves.length,4);s=restoreRoyal(JSON.stringify(s),kind);s=undoRoyal(s);assert.equal(s.moves.length,2);assert.equal(s.undoStreak,2);assert.equal(undoRoyal(s),s)
  const move=royalMoves(s)[0];s=actRoyal(s,move);assert.equal(s.undoStreak,0);assert.equal(restoreRoyal(JSON.stringify({...s,moves:[{from:999,to:0}]}),kind),null)
 }
})

test('Landlord patterns exclude wildcards; planes, attachments, bombs and rank order',()=>{
 const shape=(a,k)=>classifyClimb(a,'doudizhu').find(m=>m.kind===k)
 assert(shape([...copies(3,3),...copies(4,3),...copies(7,2)],'plane1'))
 assert(shape([...copies(3,3),...copies(4,3),...copies(7,2),...copies(8,2)],'plane2'))
 assert(shape([...copies(3,4),...copies(7,2)],'four1'))
 assert(!shape([card(14),card(2),card(3),card(4),card(5)],'straight'))
 assert(!shape([card(3),card(4),card(2,1),card(6),card(7)],'straight'))
 assert(climbBeats(shape([card(16),card(17)],'rocket'),shape(copies(2,4),'bomb')))
 assert(climbBeats(shape([card(2)],'single'),shape([card(14)],'single')))
 assert.equal(classifyClimb([...copies(3,3),...copies(4,3)],'shuangkou').length,0)
 assert(classifyClimb([...copies(3,3),...copies(4,3),...copies(5,3)],'shuangkou').some(m=>m.kind==='triples'))
 assert(!classifyClimb([...copies(3,3),card(4)],'shuangkou').length)
})
test('Landlord three-seat bidding, all pass fallback, immediate finish and spring balance',()=>{
 let s=createClimb('doudizhu',seeded(1));assert.deepEqual(s.hands.map(h=>h.length),[17,17,0,17]);for(const p of [0,1,3])s=actClimb(s,p,{type:'bid',value:0}).state
 assert.equal(s.landlord,0);assert.equal(s.hands[0].length,20);assert.equal(s.turn,0)
 s.hands=[[card(3)],[card(4)],[],[card(5)]];s=actClimb(s,0,{type:'play',cards:[card(3)]}).state
 assert.equal(s.phase,'finished');assert.deepEqual(s.scores,[4,-2,0,-2]);assert.equal(s.multiplier,2)
 s=createClimb('doudizhu',seeded(2));s=actClimb(s,0,{type:'bid',value:1}).state;assert(actClimb(s,1,{type:'bid',value:1}).error);s=actClimb(s,1,{type:'bid',value:3}).state;assert.equal(s.landlord,1);assert.equal(s.phase,'playing')
})
test('Shuangkou relay and double/single/draw scoring',()=>{
 for(const order of [[0,2,1],[0,1,2],[0,1,3]]){
  let s=createClimb('shuangkou',seeded(1));s.order=order.slice(0,2);s.hands=[[],[],[],[]];s.hands[order[2]]=[card(3)];const last=[0,1,2,3].find(x=>!order.includes(x));s.hands[last]=[card(4)];s.turn=order[2];s=actClimb(s,s.turn,{type:'play',cards:[card(3)]}).state
  assert.equal(s.phase,'finished');assert.equal(s.reason,order[1]===2?'双扣':order[2]===2?'单扣':'平扣');assert.equal(s.scores.reduce((a,b)=>a+b),0)
 }
})
test('Tractor enforces suit, pair and tractor follow; off-suit trump cuts require same pattern',()=>{
 const lead=[...pair(3),...pair(4)],o={hand:[...pair(5),...pair(6),card(8),card(9)],trump:1,levelRank:2,trick:[{seat:0,cards:lead}]}
 assert.equal(tractorPattern(lead,1).kind,'tractor');assert.equal(tractorPlayError(o,[...pair(5),...pair(6)]),null);assert(tractorPlayError(o,[...pair(5),card(8),card(9)]))
 assert(tractorPlayError({...o,hand:[card(3),card(4,1)]},[card(4,1)]))
 assert.equal(trickWinner([{seat:0,cards:pair(14)},{seat:1,cards:pair(3,1)},{seat:2,cards:[card(17),card(16)]},{seat:3,cards:pair(4,1)}],1),3)
 assert.equal(category(card(2,2),1),4);assert.equal(pointValue(card(13)),10)
 assert(tractorPattern([...pair(2,2),...pair(16)],-1));assert(!tractorPattern([...pair(2,2),...pair(2,3)],-1))
})
test('Tractor bury ownership, final trick capture and 80-point dealer change',()=>{
 let s=createTractor(seeded(1));for(let n=0;n<4;n++)s=actTractor(s,s.turn,{type:'declare',cards:null}).state
 assert.equal(s.phase,'bury');assert.equal(s.hands[0].length,33);assert(actTractor(s,0,{type:'bury',cards:s.hands[0].slice(0,7)}).error)
 s=actTractor(s,0,{type:'bury',cards:s.hands[0].slice(0,8)}).state;assert.equal(s.phase,'playing')
 s.hands=[[card(3)],[card(14)],[card(4)],[card(5)]];s.turn=0;s.trump=-1;s.points=65;s.buried=[card(5,1)];s.trick=[]
 for(let n=0;n<4;n++)s=actTractor(s,s.turn,{type:'play',cards:s.hands[s.turn]}).state
 assert.equal(s.phase,'finished');assert.equal(s.points,80);assert.equal(s.bottomPoints,10);assert.match(s.reason,/闲方上台/);assert.equal(s.winner,1)
})
function addedAction(s,level){return s.kind==='tractor'?chooseTractor(observeTractor(s,s.turn),level,seeded(s.step+10)):chooseClimb(observeClimb(s,s.turn),level,seeded(s.step+10))}
test('All three new card games finish at every level, preserve inventory, private information and replay',()=>{
 for(const kind of ['doudizhu','shuangkou','tractor'])for(const level of [0,1,2,3,4])for(const seed of [17,88]){
  let s=newCardsSession(kind,level,seed),n=0
  while(s.state.phase!=='finished'&&n++<1000){const old=s.state,r=actCardsSession(s,old.turn,addedAction(old,level));assert(!r.error,`${kind} ${level} step ${n}: ${r.error}`);s=r.session
   const state=s.state,all=state.kind==='tractor'?[...state.hands.flat(),...state.played,...(state.phase==='bidding'?state.bottom:state.buried)]:[...state.hands.flat(),...state.played,...(state.phase==='bidding'?state.bottom:[])]
   assert.equal(all.length,kind==='doudizhu'?54:108);assert.equal(new Set(all).size,all.length)
  }
  assert.equal(s.state.phase,'finished',`${kind}/${level} stuck`);assert.deepEqual(restoreCardsSession(encodeCardsSession(s),kind).state,s.state)
  const o=kind==='tractor'?observeTractor(s.state,0):observeClimb(s.state,0);assert(!('hands'in o));assert(!('bottom'in o));assert(!('buried'in o))
 }
})
test('New card games persist and enforce per-decision undo including bidding and burying',()=>{
 for(const kind of ['doudizhu','shuangkou','tractor']){
  let s=newCardsSession(kind,0,612),checks=[]
  while(checks.length<3){if(s.state.turn===0)checks.push(s);s=actCardsSession(s,s.state.turn,addedAction(s.state,1)).session}
  s=undoCardsSession(s);assert.deepEqual(s.state,checks[2].state);s=restoreCardsSession(encodeCardsSession(s),kind);s=undoCardsSession(s);assert.deepEqual(s.state,checks[1].state);assert.equal(s.undoStreak,2);assert.equal(undoCardsSession(s),s)
  s=actCardsSession(s,0,addedAction(s.state,1)).session;assert.equal(s.undoStreak,0)
 }
})
function mjFixture(hands,variant='sichuan',turn=0){
 const s=createMahjong(seeded(1),variant),used=new Map();s.hands=hands.map(h=>h.map(t=>{const n=used.get(t)||0;assert(n<4,`too many type ${t}`);used.set(t,n+1);return t*4+n}));s.wall=Array.from({length:variant==='guangdong'?136:108},(_,i)=>i).filter(t=>!s.hands.flat().includes(t));s.turn=turn;s.phase='discard';s.drawn=s.hands[turn].at(-1);s.missing=[2,2,2,2];return s
}
const win=[0,1,2,3,4,5,9,10,11,12,13,14,16,16]
test('Sichuan exchange physical cards, missing suit enforced; regional seven pairs allow a quad',()=>{
 let s=createMahjong(seeded(17),'sichuan');assert.equal(s.wall.length,55);assert.equal(s.phase,'exchange');const sent=[]
 for(let n=0;n<4;n++){const a=chooseMahjong(observeMahjong(s,s.turn),1);sent.push(a.tiles);s=actMahjong(s,s.turn,a).state}
 assert.equal(s.phase,'missing');for(let seat=0;seat<4;seat++)assert(sent[(seat+3)%4].every(t=>s.hands[seat].includes(t)))
 for(let n=0;n<4;n++)s=actMahjong(s,s.turn,{kind:'missing',suit:2}).state
 assert.equal(s.phase,'discard');assert(legalDiscards(s,0).every(t=>Math.floor(t/36)===2));assert(actMahjong(s,0,{kind:'discard',tile:s.hands[0].find(t=>t<72)}).error)
 s=mjFixture([[0,0,0,0,3,3,9,9,12,12,16,16,17,17],[],[],[]]);assert(variantWinning(s,0,s.hands[0]));s.missing[0]=0;assert(!mahjongCanHu(s,0))
})
test('Blood battle supports one discard multiple winners, skips finished players and balances score',()=>{
 let s=mjFixture([[16],win.slice(0,-1),win.slice(0,-1),[]]);s=actMahjong(s,0,{kind:'discard',tile:s.hands[0][0]}).state
 assert.equal(s.turn,1);s=actMahjong(s,1,{kind:'hu',tiles:[]}).state;s=actMahjong(s,2,{kind:'hu',tiles:[]}).state
 assert.deepEqual(s.finished,[1,2]);assert.equal(s.turn,3);assert.equal(s.wins.length,2);assert.deepEqual(s.scores,[-2,1,1,0]);assert.equal(s.phase,'discard')
 assert(!claimsFor(s,1).length)
})
test('Bloodflow self win retains ready hand, only allows drawn tile, and hides fresh draw from opponents',()=>{
 let s=mjFixture([win,[],[],[]],'bloodflow');s.rivers[3]=[100];const tile=s.drawn
 s=actMahjong(s,0,{kind:'hu',tiles:[]}).state;assert.equal(s.phase,'discard');assert.equal(s.wins.length,1);assert.equal(s.hands[0].length,13);assert(s.wonTiles.includes(tile));assert.equal(s.finished.length,0)
 s.turn=0;s.drawn=s.wall.shift();s.hands[0].push(s.drawn)
 assert.deepEqual(legalDiscards(s,0),[s.drawn]);assert.equal(kongOptions(s,0).length,0);assert(!observeMahjong(s,1).publicTiles.includes(s.drawn));assert.equal(s.scores.reduce((a,b)=>a+b),0)
})
test('Guangdong disables ordinary discard wins and chi, allows robbing a supplementary kong',()=>{
 let s=mjFixture([[16],win.slice(0,-1),[],[]],'guangdong');s=actMahjong(s,0,{kind:'discard',tile:s.hands[0][0]}).state;assert(!claimsFor(s,1).some(c=>c.kind==='hu'||c.kind==='chi'))
 s=mjFixture([[0],[1,2,3,4,5,9,10,11,12,13,14,16,16],[],[]],'guangdong');s.melds[0]=[{kind:'peng',tiles:[1,2,3],from:1}];s.wall=s.wall.filter(t=>![1,2,3].includes(t))
 s=actMahjong(s,0,{kind:'add',tile:s.hands[0][0]}).state;assert(claimsFor(s,1).some(c=>c.kind==='hu'));s=actMahjong(s,1,{kind:'hu',tiles:[]}).state;assert.equal(s.phase,'finished');assert.deepEqual(s.scores,[-3,3,0,0])
})
test('Sichuan wall settlement checks missing suit/readiness, refunds kong and cannot double settle',()=>{
 let s=mjFixture([win.slice(0,-1),[18,0,4,8,10,13,17,20,23,26,2,6,14],[0,4,8,9,13,17,18,22,26,3,7,12,16],[]]);s.wall=[];s.scores=[-2,0,2,0];s.kongLedger=[{from:0,to:2,value:2,refunded:false}]
 finishMahjongWall(s);assert.equal(s.phase,'finished');assert(s.scores[0]>0);assert(s.scores[1]<0);assert(s.kongLedger[0].refunded);assert.equal(s.scores.reduce((a,b)=>a+b),0);const scores=[...s.scores];finishMahjongWall(s);assert.deepEqual(s.scores,scores)
})
test('All regional Mahjong variants finish every difficulty with tile conservation and isolated replays',()=>{
 for(const variant of ['sichuan','bloodflow','guangdong'])for(const level of [0,1,2,3,4]){
  let s=newTable('mahjong',level,17,variant),n=0
  while(s.state.phase!=='finished'&&n++<1200){const old=s.state,a=chooseMahjong(observeMahjong(old,old.turn),level,seeded(old.step+13));const r=tableAct(s,old.turn,{game:'mahjong',action:a});assert(!r.error,`${variant}/${level}/${n}: ${r.error}`);s=r.session
   const state=s.state,all=[...state.hands.flat(),...state.wall,...state.rivers.flat(),...state.wonTiles,...state.melds.flat().flatMap(m=>m.tiles)]
   assert.equal(all.length,variant==='guangdong'?136:108,`${variant} inventory`);assert.equal(new Set(all).size,all.length);assert.equal(state.scores.reduce((a,b)=>a+b),0)
  }
  assert.equal(s.state.phase,'finished',`${variant}/${level} stuck`);assert.deepEqual(restoreTable(encodeTable(s),'mahjong',variant).state,s.state);assert.equal(restoreTable(encodeTable(s),'mahjong'),null)
 }
 assert.notEqual(tableKey('mahjong','sichuan'),tableKey('mahjong','bloodflow'));assert(restoreTable(encodeTable(newTable('mahjong',0,17)),'mahjong'))
 let s=newTable('mahjong',0,17,'sichuan');s=tableAct(s,0,{game:'mahjong',action:chooseMahjong(observeMahjong(s.state,0),1)}).session;s=undoTable(s);assert.equal(s.variant,'sichuan');assert.equal(s.state.phase,'exchange');assert.equal(s.undoStreak,1)
})
