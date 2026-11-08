import { seeded } from './table-session.ts'
import { createClimb,actClimb } from './climbing.ts'
import type { ClimbState,ClimbKind,ClimbAction } from './climbing.ts'
import { createTractor,actTractor } from './tractor.ts'
import type { TractorState,TractorAction } from './tractor.ts'
import type { Level } from './game.ts'
import type { SeatId } from './guandan.ts'
import { undoLimit } from './storage.ts'
export type AddedCardKind=ClimbKind|'tractor'
export type AddedCardAction=ClimbAction|TractorAction
export type AddedCardSession={kind:AddedCardKind;seed:number;level:Level;actions:{seat:SeatId;action:AddedCardAction}[];undoStreak:number;state:ClimbState|TractorState}
export const addedCardNames={doudizhu:'斗地主',shuangkou:'双扣',tractor:'升级'}
export const addedCardKey=(kind:AddedCardKind)=>`dsh-board-games-${kind}-v1`
export function newCardsSession(kind:AddedCardKind,level:Level,seed=Math.floor(Math.random()*4294967296)):AddedCardSession{
  return {kind,level,seed,actions:[],undoStreak:0,state:kind==='tractor'?createTractor(seeded(seed)):createClimb(kind,seeded(seed))}
}
export function actCardsSession(s:AddedCardSession,seat:SeatId,action:AddedCardAction):{session:AddedCardSession;error?:string}{
  const result=s.state.kind==='tractor'?actTractor(s.state,seat,action as TractorAction):actClimb(s.state,seat,action as ClimbAction)
  return result.error?{session:s,error:result.error}:{session:{...s,state:result.state,actions:[...s.actions,{seat,action}],undoStreak:seat===0?0:s.undoStreak}}
}
export function encodeCardsSession(s:AddedCardSession){return JSON.stringify({version:1,kind:s.kind,seed:s.seed,level:s.level,actions:s.actions,undoStreak:s.undoStreak})}
export function restoreCardsSession(raw:string|null,kind:AddedCardKind):AddedCardSession|null {
  try{const data=JSON.parse(raw||'null');if(!data||data.version!==1||data.kind!==kind||!Number.isInteger(data.seed)||data.seed<0||data.seed>4294967295||![0,1,2,3,4].includes(data.level)||!Array.isArray(data.actions)||data.actions.length>3000)return null
    let s=newCardsSession(kind,data.level,data.seed)
    for(const entry of data.actions){if(![0,1,2,3].includes(entry.seat)||!entry.action)return null;const n=actCardsSession(s,entry.seat,entry.action);if(n.error)return null;s=n.session}
    s.undoStreak=Number.isInteger(data.undoStreak)?Math.max(0,Math.min(undoLimit(s.level),data.undoStreak)):0;return s
  }catch{return null}
}
export function undoCardsSession(s:AddedCardSession):AddedCardSession{
  if(s.state.phase==='finished'||s.undoStreak>=undoLimit(s.level))return s
  let index=s.actions.length-1;while(index>=0&&s.actions[index].seat!==0)index--
  if(index<0)return s
  let result=newCardsSession(s.kind,s.level,s.seed)
  for(const e of s.actions.slice(0,index))result=actCardsSession(result,e.seat,e.action).session
  return {...result,undoStreak:s.undoStreak+1}
}
