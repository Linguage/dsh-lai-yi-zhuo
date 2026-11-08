import { cardRank, cardSuit, shuffle, nextSeat, suitLabels } from './guandan.ts'
import type { Card, SeatId } from './guandan.ts'
import type { Level } from './game.ts'

export type TractorAction={type:'declare';cards:Card[]|null}|{type:'bury'|'play';cards:Card[]}
export type TrickPlay={seat:SeatId;cards:Card[]}
export type TractorState={
  kind:'tractor';hands:Card[][];turn:SeatId;phase:'bidding'|'bury'|'playing'|'finished';trump:number;dealer:SeatId;levelRank:number
  bottom:Card[];buried:Card[];bid:{seat:SeatId;cards:Card[];strength:number}|null;passes:number
  trick:TrickPlay[];lastTrick:TrickPlay[];played:Card[];points:number;round:number;step:number;winner:0|1|null;reason:string;bottomPoints:number
}
export type TractorObservation=Pick<TractorState,'phase'|'turn'|'trump'|'dealer'|'levelRank'|'bid'|'trick'|'points'|'played'> & {hand:Card[];counts:number[]}
export type TractorPattern={kind:'single'|'pair'|'tractor';count:number;category:number;high:number}
export const pointValue=(card:Card)=>cardRank(card)===5?5:[10,13].includes(cardRank(card))?10:0
export const trumpName=(trump:number)=>trump===-1?'无主':suitLabels[trump]+' 主'
export const category=(c:Card,trump:number,level=2)=>cardRank(c)>=16||cardRank(c)===level||cardSuit(c)===trump?4:cardSuit(c)
export function tractorPower(c:Card,trump:number,level=2){
  const rank=cardRank(c);if(rank===17)return 18;if(rank===16)return 17
  if(rank===level)return cardSuit(c)===trump?16:15
  return rank+(rank<level?1:0)
}
export function sortTractor(cards:Card[],trump:number,level=2){return [...cards].sort((a,b)=>category(b,trump,level)-category(a,trump,level)||tractorPower(b,trump,level)-tractorPower(a,trump,level)||a%54-b%54)}
function pairs(cards:Card[]){const map=new Map<number,Card[]>();cards.forEach(c=>map.set(c%54,[...map.get(c%54)||[],c]));return [...map.values()].filter(a=>a.length===2)}
export function tractorPattern(cards:Card[],trump:number,level=2):TractorPattern|null {
  if(!cards.length||new Set(cards).size!==cards.length)return null
  const cats=new Set(cards.map(c=>category(c,trump,level)));if(cats.size!==1)return null
  const cat=[...cats][0],ps=pairs(cards),powers=ps.map(a=>tractorPower(a[0],trump,level)).sort((a,b)=>a-b)
  if(cards.length===1)return {kind:'single',count:1,category:cat,high:tractorPower(cards[0],trump,level)}
  if(ps.length*2!==cards.length)return null
  if(ps.length===1)return {kind:'pair',count:2,category:cat,high:powers[0]}
  // No-trump has no main level rank, so side level pairs connect directly to jokers.
  const normalized=powers.map(p=>trump===-1&&p>=17?p-1:p)
  if(!normalized.every((p,i)=>!i||p===normalized[i-1]+1))return null
  return {kind:'tractor',count:cards.length,category:cat,high:powers.at(-1)!}
}
function runs(hand:Card[],count:number,trump:number,level:number){
  const ps=pairs(hand),out:Card[][]=[]
  for(let cat=0;cat<5;cat++){
    const same=ps.filter(a=>category(a[0],trump,level)===cat),powers=[...new Set(same.map(a=>tractorPower(a[0],trump,level)))].sort((a,b)=>a-b)
    for(let i=0;i+count<=powers.length;i++){
      const wanted=powers.slice(i,i+count),cards=wanted.flatMap(p=>same.find(a=>tractorPower(a[0],trump,level)===p)!)
      if(tractorPattern(cards,trump,level))out.push(cards)
    }
  }return out
}
export function tractorPlayError(o:Pick<TractorObservation,'hand'|'trump'|'levelRank'|'trick'>,cards:Card[]):string|null {
  if(!cards.length||new Set(cards).size!==cards.length||cards.some(c=>!o.hand.includes(c)))return '请选择手中的牌'
  if(!o.trick.length)return tractorPattern(cards,o.trump,o.levelRank)?null:'首引请出单张、对子或拖拉机'
  const lead=tractorPattern(o.trick[0].cards,o.trump,o.levelRank)!,n=lead.count
  if(cards.length!==n)return `这一圈需出 ${n} 张`
  const same=o.hand.filter(c=>category(c,o.trump,o.levelRank)===lead.category),follow=cards.filter(c=>category(c,o.trump,o.levelRank)===lead.category)
  if(follow.length!==Math.min(n,same.length))return '需要先跟出首引的花色（主牌是一门）'
  if(lead.kind!=='single'){
    const required=Math.min(Math.floor(n/2),pairs(same).length)
    if(pairs(follow).length<required)return '有对子时需优先跟对子'
    if(lead.kind==='tractor'&&runs(same,n/2,o.trump,o.levelRank).length&&tractorPattern(follow,o.trump,o.levelRank)?.kind!=='tractor')return '有同长度拖拉机时必须跟出'
  }
  return null
}
export function trickWinner(trick:TrickPlay[],trump:number,level=2):SeatId{
  const lead=tractorPattern(trick[0].cards,trump,level)!,eligible=(cards:Card[])=>{
    const p=tractorPattern(cards,trump,level);return p&&p.kind===lead.kind&&p.count===lead.count&&(p.category===lead.category||p.category===4)?p:null
  }
  let best=trick[0].seat,pattern=lead
  for(const play of trick.slice(1)){const p=eligible(play.cards);if(p&&(p.category===4&&pattern.category!==4||p.category===pattern.category&&p.high>pattern.high)){best=play.seat;pattern=p}}
  return best
}
export function declarations(hand:Card[],level=2):{cards:Card[];strength:number;suit:number}[]{
  const out:{cards:Card[];strength:number;suit:number}[]=[]
  for(let suit=0;suit<4;suit++){
    const a=hand.filter(c=>cardRank(c)===level&&cardSuit(c)===suit)
    if(a.length)out.push({cards:a.slice(0,1),strength:1,suit})
    if(a.length===2)out.push({cards:a,strength:2,suit})
  }
  for(const rank of [16,17]){const a=hand.filter(c=>cardRank(c)===rank);if(a.length===2)out.push({cards:a,strength:rank===16?3:4,suit:-1})}
  return out
}
export function createTractor(random=Math.random):TractorState {
  const deck=shuffle(Array.from({length:108},(_,i)=>i),random)
  return {kind:'tractor',hands:Array.from({length:4},(_,p)=>sortTractor(deck.slice(p*25,p*25+25),-1)),turn:0,phase:'bidding',trump:-1,dealer:0,levelRank:2,bottom:deck.slice(100),buried:[],bid:null,passes:0,trick:[],lastTrick:[],played:[],points:0,round:0,step:0,winner:null,reason:'',bottomPoints:0}
}
export function observeTractor(s:TractorState,seat:SeatId):TractorObservation{return {phase:s.phase,turn:seat,trump:s.trump,dealer:s.dealer,levelRank:s.levelRank,bid:structuredClone(s.bid),trick:structuredClone(s.trick),points:s.points,played:[...s.played],hand:[...s.hands[seat]],counts:s.hands.map(h=>h.length)}}
export function actTractor(state:TractorState,seat:SeatId,action:TractorAction):{state:TractorState;error?:string}{
  const bad=(error:string)=>({state,error});if(state.turn!==seat||state.phase==='finished')return bad('还没轮到你')
  const s=structuredClone(state)
  if(s.phase==='bidding'){
    if(action.type!=='declare')return bad('请亮主或不亮')
    if(action.cards===null)s.passes++
    else{
      const declared=declarations(s.hands[seat],s.levelRank).find(d=>d.cards.length===action.cards!.length&&d.cards.every(c=>action.cards!.includes(c)))
      if(!declared||declared.strength<=(s.bid?.strength||0))return bad('需要用级牌亮主，反主需更强牌型')
      s.bid={seat,cards:declared.cards,strength:declared.strength};s.trump=declared.suit;s.dealer=seat;s.passes=0
    }
    if(s.passes>=(s.bid?3:4)||s.bid?.strength===4){s.hands[s.dealer]=sortTractor([...s.hands[s.dealer],...s.bottom],s.trump,s.levelRank);s.turn=s.dealer;s.phase='bury'}else s.turn=nextSeat(seat)
  }else if(s.phase==='bury'){
    if(action.type!=='bury'||action.cards.length!==8||new Set(action.cards).size!==8||action.cards.some(c=>!s.hands[seat].includes(c)))return bad('请选择 8 张牌扣底')
    s.buried=[...action.cards];s.hands[seat]=sortTractor(s.hands[seat].filter(c=>!action.cards.includes(c)),s.trump,s.levelRank);s.phase='playing'
  }else{
    if(action.type!=='play')return bad('这一圈需要跟牌')
    const error=tractorPlayError(observeTractor(s,seat),action.cards);if(error)return bad(error)
    if(!s.trick.length)s.lastTrick=[]
    s.hands[seat]=s.hands[seat].filter(c=>!action.cards.includes(c));s.trick.push({seat,cards:[...action.cards]});s.played.push(...action.cards)
    if(s.trick.length===4){
      const winner=trickWinner(s.trick,s.trump,s.levelRank),points=s.trick.flatMap(p=>p.cards).reduce((n,c)=>n+pointValue(c),0)
      if(winner%2!==s.dealer%2)s.points+=points
      s.lastTrick=s.trick;s.trick=[];s.round++;s.turn=winner
      if(s.hands.every(h=>!h.length)){
        if(winner%2!==s.dealer%2){const lead=tractorPattern(s.lastTrick[0].cards,s.trump,s.levelRank)!,factor=lead.kind==='single'?2:lead.kind==='pair'?4:2**(lead.count/2+1);s.bottomPoints=s.buried.reduce((n,c)=>n+pointValue(c),0)*factor;s.points+=s.bottomPoints}
        s.phase='finished';s.winner=(s.points>=80?1-s.dealer%2:s.dealer%2) as 0|1
        const levels=s.points===0?3:s.points<40?2:s.points<80?1:Math.floor((s.points-80)/40)
        s.reason=`${levels===0?'闲方上台':`${s.points>=80?'闲方':'庄方'}升 ${levels} 级`} · 抓分 ${s.points}${s.bottomPoints?`（抠底 ${s.bottomPoints}）`:''}`
      }
    }else s.turn=nextSeat(seat)
  }
  s.step++;return {state:s}
}
export function tractorCandidates(o:TractorObservation):Card[][]{
  if(!o.trick.length){const out=o.hand.map(c=>[c]);out.push(...pairs(o.hand));for(let n=2;n<=Math.floor(o.hand.length/2);n++)out.push(...runs(o.hand,n,o.trump,o.levelRank));return out}
  const lead=tractorPattern(o.trick[0].cards,o.trump,o.levelRank)!,n=lead.count,same=o.hand.filter(c=>category(c,o.trump,o.levelRank)===lead.category),out:Card[][]=[]
  if(same.length>=n){
    if(lead.kind==='single')return same.map(c=>[c])
    const exact=runs(same,n/2,o.trump,o.levelRank);if(exact.length)return exact
    const ps=pairs(same),required=Math.min(ps.length,n/2)
    for(const reverse of [false,true]){
      const sorted=[...ps].sort((a,b)=>(tractorPower(a[0],o.trump,o.levelRank)-tractorPower(b[0],o.trump,o.levelRank))*(reverse?-1:1))
      const chosen=sorted.slice(0,required).flat(),rest=same.filter(c=>!chosen.includes(c)).sort((a,b)=>(pointValue(a)-pointValue(b)||tractorPower(a,o.trump,o.levelRank)-tractorPower(b,o.trump,o.levelRank))*(reverse?-1:1));out.push([...chosen,...rest.slice(0,n-chosen.length)])
    }
  }else{
    const rest=o.hand.filter(c=>!same.includes(c))
    for(const reverse of [false,true]){const sorted=[...rest].sort((a,b)=>(category(a,o.trump,o.levelRank)-category(b,o.trump,o.levelRank)||pointValue(a)-pointValue(b)||tractorPower(a,o.trump,o.levelRank)-tractorPower(b,o.trump,o.levelRank))*(reverse?-1:1));out.push([...same,...sorted.slice(0,n-same.length)])}
    if(!same.length){const trumps=o.hand.filter(c=>category(c,o.trump,o.levelRank)===4);if(n===1)out.push(...trumps.map(c=>[c]));else out.push(...runs(trumps,n/2,o.trump,o.levelRank))}
  }
  return out.filter(cards=>!tractorPlayError(o,cards))
}
export function chooseTractor(o:TractorObservation,level:Level,random=Math.random):TractorAction{
  if(o.phase==='bidding'){
    const options=declarations(o.hand,o.levelRank).filter(d=>d.strength>(o.bid?.strength||0));options.sort((a,b)=>o.hand.filter(c=>category(c,b.suit,o.levelRank)===4).length-o.hand.filter(c=>category(c,a.suit,o.levelRank)===4).length)
    return {type:'declare',cards:options.length&&(level>0||random()>.4)?options[0].cards:null}
  }
  if(o.phase==='bury'){
    const ps=pairs(o.hand).flat(),cost=(c:Card)=>category(c,o.trump,o.levelRank)===4?100+tractorPower(c,o.trump,o.levelRank):pointValue(c)*2+tractorPower(c,o.trump,o.levelRank)+(ps.includes(c)&&level>=2?20:0)
    return {type:'bury',cards:[...o.hand].sort((a,b)=>cost(a)-cost(b)).slice(0,8)}
  }
  const options=tractorCandidates(o);if(!options.length)throw Error('无法生成合法跟牌')
  if(level===0)return {type:'play',cards:options[Math.floor(random()*options.length)]}
  const teamLeading=o.trick.length>0&&trickWinner(o.trick,o.trump,o.levelRank)%2===o.turn%2
  const cost=(cards:Card[])=>{
    const points=cards.reduce((n,c)=>n+pointValue(c),0),power=cards.reduce((n,c)=>n+tractorPower(c,o.trump,o.levelRank)+(category(c,o.trump,o.levelRank)===4?15:0),0)
    if(!o.trick.length)return power*.3-cards.length*(level>=2?12:4)
    const win=trickWinner([...o.trick,{seat:o.turn,cards}],o.trump,o.levelRank)===o.turn
    return power*.4+(teamLeading?-points*2:points*2)-(win&&!teamLeading?(level>=3?30:15):0)
  }
  options.sort((a,b)=>cost(a)-cost(b));return {type:'play',cards:options[0]}
}
