import { cardRank, rankPower, rankLabel, sortCards, shuffle, partner } from './guandan.ts'
import type { Card, SeatId } from './guandan.ts'
import type { Level } from './game.ts'

export type ClimbKind='doudizhu'|'shuangkou'
export type ClimbMove={cards:Card[];kind:string;rank:number;key:string;label:string;bomb:number}
export type ClimbAction={type:'bid';value:number}|{type:'play';cards:Card[]|null;key?:string}
export type ClimbState={
  kind:ClimbKind;hands:Card[][];turn:SeatId;phase:'bidding'|'playing'|'finished';bottom:Card[]
  bids:(number|null)[];landlord:SeatId|null;base:number;multiplier:number;scores:number[]
  last:{seat:SeatId;move:ClimbMove}|null;passed:SeatId[];order:SeatId[];plays:(ClimbMove|'pass'|null)[]
  played:Card[];playCounts:number[];step:number;winner:0|1|null;reason:string
}
export type ClimbObservation=Pick<ClimbState,'kind'|'turn'|'phase'|'bids'|'landlord'|'last'|'order'|'played'> & {hand:Card[];counts:number[]}
export const climbSeats=(kind:ClimbKind):SeatId[]=>kind==='doudizhu'?[0,1,3]:[0,1,2,3]
export const climbTeam=(state:Pick<ClimbState,'kind'|'landlord'>,seat:number)=>state.kind==='doudizhu'?Number(seat!==state.landlord):seat%2
const labels:Record<string,string>={single:'单张',pair:'对子',triple:'三张',straight:'顺子',pairs:'连对',triples:'连三张',triple1:'三带一',triple2:'三带二',plane1:'飞机带单',plane2:'飞机带对',four1:'四带二',four2:'四带两对',bomb:'炸弹',rocket:'王炸'}
function grouped(cards:Card[]){const groups=new Map<number,Card[]>();for(const c of cards){const r=cardRank(c);groups.set(r,[...groups.get(r)||[],c])}return groups}
function consecutive(ranks:number[]){const sorted=[...ranks].sort((a,b)=>a-b);return sorted[0]>=3&&sorted.at(-1)!<=14&&sorted.every((r,i)=>!i||r===sorted[i-1]+1)}
function move(cards:Card[],kind:string,rank:number):ClimbMove{
  const bomb=kind==='rocket'?100:kind==='bomb'?cards.length:0
  return {cards:sortCards(cards),kind,rank,key:`${kind}:${rank}:${cards.length}`,label:`${labels[kind]}${kind==='rocket'?'':' · '+rankLabel(rank)}`,bomb}
}
export function classifyClimb(cards:Card[],kind:ClimbKind):ClimbMove[]{
  if(!cards.length||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||c>=(kind==='doudizhu'?54:108)))return []
  const g=grouped(cards),ranks=[...g.keys()],n=cards.length,out:ClimbMove[]=[]
  const add=(type:string,rank:number)=>out.push(move(cards,type,rank))
  if(n===1)add('single',ranks[0])
  if(ranks.length===1){if(n===2)add('pair',ranks[0]);if(n===3)add('triple',ranks[0]);if(ranks[0]<16&&n>=4&&(kind==='shuangkou'||n===4))add('bomb',ranks[0])}
  if(ranks.every(r=>r>=16)&&n===(kind==='doudizhu'?2:4))add('rocket',17)
  if(n>=5&&ranks.length===n&&consecutive(ranks))add('straight',Math.max(...ranks))
  if(n>=6&&ranks.length*2===n&&[...g.values()].every(a=>a.length===2)&&consecutive(ranks))add('pairs',Math.max(...ranks))
  if(n>=(kind==='doudizhu'?6:9)&&ranks.length*3===n&&[...g.values()].every(a=>a.length===3)&&consecutive(ranks))add('triples',Math.max(...ranks))
  if(kind==='doudizhu'){
    for(const [r,a] of g)if(a.length===3){const rest=cards.filter(c=>cardRank(c)!==r);if(n===4)add('triple1',r);if(n===5&&grouped(rest).size===1)add('triple2',r)}
    for(const [r,a]of g)if(a.length===4){const rest=cards.filter(c=>cardRank(c)!==r);if(n===6)add('four1',r);if(n===8&&grouped(rest).size===2&&[...grouped(rest).values()].every(v=>v.length===2))add('four2',r)}
    for(const wing of [1,2]){
      const length=n/(3+wing);if(!Number.isInteger(length)||length<2)continue
      for(let start=3;start+length-1<=14;start++){
        const body=Array.from({length},(_,i)=>start+i);if(!body.every(r=>(g.get(r)?.length||0)>=3))continue
        const rest=cards.filter(c=>!body.includes(cardRank(c)))
        if(rest.length!==length*wing)continue
        if(wing===1||grouped(rest).size===length&&[...grouped(rest).values()].every(a=>a.length===2))add(`plane${wing}`,start+length-1)
      }
    }
  }
  return out
}
export function climbBeats(a:ClimbMove,b:ClimbMove|null){
  if(!b)return true
  if(a.bomb||b.bomb)return a.bomb>b.bomb||a.bomb===b.bomb&&a.bomb>0&&rankPower(a.rank)>rankPower(b.rank)
  return a.kind===b.kind&&a.cards.length===b.cards.length&&rankPower(a.rank)>rankPower(b.rank)
}
export function climbMoves(o:ClimbObservation):ClimbMove[]{
  const g=grouped(o.hand),candidates:Card[][]=[],keys=new Set<string>(),out:ClimbMove[]=[]
  const append=(cards:Card[])=>{for(const m of classifyClimb(cards,o.kind))if(climbBeats(m,o.last?.move||null)&&!keys.has(m.key+':'+m.cards.join(','))){keys.add(m.key+':'+m.cards.join(','));out.push(m)}}
  for(const a of g.values())for(let n=1;n<=a.length;n++)if(n<=3||o.kind==='shuangkou'||n===4)candidates.push(a.slice(0,n))
  const jokers=o.hand.filter(c=>cardRank(c)>=16);if(jokers.length===(o.kind==='doudizhu'?2:4))candidates.push(jokers)
  const body:Card[][]=[]
  for(const copies of [1,2,3])for(let start=3;start<=14;start++)for(let end=start;end<=14;end++){
    const length=end-start+1;if(!Array.from({length},(_,i)=>(g.get(start+i)?.length||0)>=copies).every(Boolean))break
    if(length<(copies===1?5:copies===2?3:o.kind==='shuangkou'?3:2))continue
    const cards=Array.from({length},(_,i)=>g.get(start+i)!.slice(0,copies)).flat();candidates.push(cards);if(copies===3)body.push(cards)
  }
  if(o.kind==='doudizhu'){
    for(const a of g.values()){if(a.length>=3)body.push(a.slice(0,3));if(a.length===4)body.push(a)}
    for(const main of body){const ranks=new Set(main.map(cardRank)),rest=o.hand.filter(c=>!ranks.has(cardRank(c))),count=main.length===4?2:main.length/3
      const rg=[...grouped(rest).values()].sort((a,b)=>rankPower(cardRank(a[0]))-rankPower(cardRank(b[0])))
      // Different low-cost attachment sets give the AI choices without private information.
      for(const reverse of [false,true]){
        const sorted=reverse?[...rg].reverse():rg
        const singles=sorted.flat().slice(0,count),pairs=sorted.filter(a=>a.length>=2).slice(0,count).flatMap(a=>a.slice(0,2))
        if(singles.length===count)candidates.push([...main,...singles])
        if(pairs.length===count*2)candidates.push([...main,...pairs])
      }
    }
  }
  candidates.forEach(append);return out
}
export function createClimb(kind:ClimbKind,random=Math.random):ClimbState{
  const deck=shuffle(Array.from({length:kind==='doudizhu'?54:108},(_,i)=>i),random),hands:Card[][]=[[],[],[],[]]
  climbSeats(kind).forEach((seat,i)=>hands[seat]=sortCards(deck.slice(i*(kind==='doudizhu'?17:27),(i+1)*(kind==='doudizhu'?17:27))))
  return {kind,hands,turn:0,phase:kind==='doudizhu'?'bidding':'playing',bottom:kind==='doudizhu'?deck.slice(51):[],bids:[null,null,null,null],landlord:null,base:1,multiplier:1,scores:[0,0,0,0],last:null,passed:[],order:[],plays:[null,null,null,null],played:[],playCounts:[0,0,0,0],step:0,winner:null,reason:''}
}
export function observeClimb(s:ClimbState,seat:SeatId):ClimbObservation{return {kind:s.kind,turn:seat,phase:s.phase,bids:[...s.bids],landlord:s.landlord,last:structuredClone(s.last),order:[...s.order],played:[...s.played],hand:[...s.hands[seat]],counts:s.hands.map(a=>a.length)}}
export function actClimb(state:ClimbState,seat:SeatId,action:ClimbAction):{state:ClimbState;error?:string}{
  const bad=(error:string)=>({state,error});if(state.turn!==seat||state.phase==='finished')return bad('还没轮到你')
  const seats=climbSeats(state.kind),next=(p:number)=>seats[(seats.indexOf(p as SeatId)+1)%seats.length],s=structuredClone(state)
  if(s.phase==='bidding'){
    if(action.type!=='bid'||![0,1,2,3].includes(action.value)||action.value!==0&&action.value<=Math.max(...s.bids.map(n=>n||0)))return bad('叫分需高于当前分数')
    s.bids[seat]=action.value;s.step++
    if(action.value===3||seats.every(p=>s.bids[p]!==null)){
      const max=Math.max(...s.bids.map(n=>n||0));s.landlord=max?seats.find(p=>s.bids[p]===max)!:0;s.base=max||1;s.hands[s.landlord]=sortCards([...s.hands[s.landlord],...s.bottom]);s.turn=s.landlord;s.phase='playing'
    }else s.turn=next(seat)
    return {state:s}
  }
  if(action.type!=='play')return bad('现在需要出牌')
  const cards=action.cards
  if(cards===null){if(!s.last)return bad('领出不能不出');s.passed.push(seat);s.plays[seat]='pass'}
  else{
    if(cards.some(c=>!s.hands[seat].includes(c)))return bad('请选择手中的牌')
    const matches=classifyClimb(cards,s.kind).filter(m=>climbBeats(m,s.last?.move||null)),m=matches.find(m=>m.key===action.key)||(!action.key?matches[0]:null)
    if(!m)return bad('牌型不成立，或未压过上一手')
    s.hands[seat]=s.hands[seat].filter(c=>!cards.includes(c));s.played.push(...cards);s.last={seat,move:m};s.plays[seat]=m;s.passed=[];s.playCounts[seat]++
    if(m.bomb&&s.kind==='doudizhu')s.multiplier*=2
    if(!s.hands[seat].length){
      s.order.push(seat)
      if(s.kind==='doudizhu'){
        s.phase='finished';s.winner=climbTeam(s,seat) as 0|1
        const spring=s.winner===0?seats.filter(p=>p!==s.landlord).every(p=>s.playCounts[p]===0):s.playCounts[s.landlord!]===1
        if(spring)s.multiplier*=2;s.reason=`${s.winner===0?'地主':'农民'}获胜${spring?' · 春天':''}`
        for(const p of seats)s.scores[p]=(climbTeam(s,p)===s.winner?1:-1)*s.base*s.multiplier*(p===s.landlord?2:1)
      }else if(s.order.length===3){
        s.order.push(seats.find(p=>!s.order.includes(p))!);s.phase='finished';const partnerRank=s.order.indexOf(partner(s.order[0]))+1
        s.winner=partnerRank===4?null:s.order[0]%2 as 0|1;s.reason=partnerRank===2?'双扣':partnerRank===3?'单扣':'平扣'
        s.scores=seats.map(p=>s.winner===null?0:(p%2===s.winner?1:-1)*(partnerRank===2?2:1))
      }
    }
  }
  s.step++;if(s.phase==='finished')return {state:s}
  const active=seats.filter(p=>s.hands[p].length)
  if(s.last&&active.every(p=>p===s.last!.seat||s.passed.includes(p))){
    let lead=s.last.seat
    if(!s.hands[lead].length){lead=partner(lead);if(!s.hands[lead].length){lead=next(s.last.seat);while(!s.hands[lead].length)lead=next(lead)}}
    s.turn=lead;s.last=null;s.passed=[];s.plays=[null,null,null,null]
  }else{s.turn=next(seat);while(!s.hands[s.turn].length)s.turn=next(s.turn)}
  return {state:s}
}
export function chooseClimb(o:ClimbObservation,level:Level,random=Math.random):ClimbAction{
  if(o.phase==='bidding'){
    const strength=o.hand.reduce((n,c)=>n+(cardRank(c)>=16?3:cardRank(c)===2?2:cardRank(c)>=13?1:0),0)+[...grouped(o.hand).values()].filter(a=>a.length===4).length*4
    const bid=level===0?Math.floor(random()*4):strength>17?3:strength>12?2:strength>8?1:0
    return {type:'bid',value:bid>Math.max(...o.bids.map(n=>n||0))?bid:0}
  }
  const moves=climbMoves(o),finish=moves.find(m=>m.cards.length===o.hand.length)
  if(finish)return {type:'play',cards:finish.cards,key:finish.key}
  if(!moves.length||level>0&&o.last&&climbTeam(o,o.last.seat)===climbTeam(o,o.turn))return {type:'play',cards:null}
  const group=grouped(o.hand),danger=o.counts.some((n,p)=>climbTeam(o,p)!==climbTeam(o,o.turn)&&n>0&&n<=3)
  const cost=(m:ClimbMove)=>rankPower(m.rank)*.5-m.cards.length*7+(m.bomb?(danger?5:55):0)+(level>=2?[...new Set(m.cards.map(cardRank))].reduce((v,r)=>v+((group.get(r)?.length||0)>m.cards.filter(c=>cardRank(c)===r).length?(group.get(r)!.length>=4?30:6):0),0):0)+(level>=3?grouped(o.hand.filter(c=>!m.cards.includes(c))).size*(level===4?4:2):0)
  moves.sort((a,b)=>cost(a)-cost(b));const pick=level===0?moves[Math.floor(random()*moves.length)]:moves[level===1?Math.floor(random()*Math.min(3,moves.length)):0]
  if(o.last&&pick.bomb&&!danger&&o.hand.length>10)return {type:'play',cards:null}
  return {type:'play',cards:pick.cards,key:pick.key}
}
