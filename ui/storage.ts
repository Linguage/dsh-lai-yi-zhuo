import { createGame, play, resign, finishScore } from './game.ts'
import type { Position, Color, Level } from './game.ts'
export type Session = {position:Position;history:Position[];human:Color;level:Level;dead:number[];undoStreak:number}
export type Preferences = {winrate:boolean;suggestions:boolean;sound:boolean}
export const SESSION_KEY='dsh-board-games-session-v1', PREFS_KEY='dsh-board-games-preferences-v1'
export const undoLimit = (level:Level) => Math.max(0, 2 - level)
export function restore(raw:string|null):Session|null {
  if(!raw) return null
  try {
    const data=JSON.parse(raw),p=data.position
    if(data.version!==1||![1,2].includes(data.human)||![0,1,2,3,4].includes(data.level)||!['go','gomoku'].includes(p.kind)||!Array.isArray(p.moves)||p.moves.length>3000) return null
    let position=createGame(p.kind,p.size);const history:Position[]=[]
    for(const m of p.moves) {
      if(m.color!==position.turn||!(m.point===null||Number.isInteger(m.point))) return null
      // A scored game can be resumed without a move; replay the next turn after that boundary.
      if(position.phase==='scoring') position={...position,phase:'playing',passes:0,reason:''}
      const next=play(position,m.point);if(next.error) return null
      history.push(position);position=next.state
    }
    const dead=Array.isArray(data.dead)?data.dead.filter((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<position.board.length&&position.board[Number(n)]):[]
    if(p.phase==='finished') {
      if(position.phase==='scoring') position=finishScore(position,dead)
      else if(position.phase==='playing'&&p.reason===`${data.human===1?'黑棋':'白棋'}认输`) position=resign(position,data.human)
      else if(position.phase!=='finished') return null
    } else if(p.phase==='playing'&&position.phase==='scoring') position={...position,phase:'playing',passes:0,reason:''}
    const limit=undoLimit(data.level)
    const undoStreak=Number.isInteger(data.undoStreak)?Math.max(0,Math.min(limit,data.undoStreak)):0
    return {position,history,human:data.human,level:data.level,dead,undoStreak}
  } catch {return null}
}
export function encode(session:Session):string {
  const {position,human,level,dead,undoStreak}=session
  return JSON.stringify({version:1,position:{kind:position.kind,size:position.size,moves:position.moves,phase:position.phase,reason:position.reason},human,level,dead,undoStreak})
}
export function readPreferences(raw:string|null):Preferences {
  try {const p=JSON.parse(raw||'{}');return {winrate:p.winrate===true,suggestions:p.suggestions===true,sound:p.sound!==false}} catch {return {winrate:false,suggestions:false,sound:true}}
}
