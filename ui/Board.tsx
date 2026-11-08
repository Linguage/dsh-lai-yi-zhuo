import { useRef, useState } from 'react'
import type { Cell, Position } from './game.ts'
import { coordinate } from './game.ts'
import type { Candidate } from './ai.ts'
type Props={position:Position;onPlay:(p:number)=>void;disabled?:boolean;suggestions?:Candidate[];dead?:number[];ownership?:Cell[];mini?:boolean}
export function Board({position:p,onPlay,disabled=false,suggestions=[],dead=[],ownership,mini=false}:Props) {
  const ref=useRef<HTMLDivElement>(null),[focus,setFocus]=useState(Math.floor(p.size*p.size/2))
  const step=88/(p.size-1),last=p.moves.at(-1)?.point
  const stars=p.size===9?[2,4,6]:p.size===19?[3,9,15]:[3,7,11]
  return <div className={`wood-board ${mini?'mini':''}`}>
    <svg className="grid-lines" viewBox="0 0 100 100" aria-hidden="true">
      {Array.from({length:p.size},(_,i)=><g key={i}><path d={`M6 ${6+i*step}H94M${6+i*step} 6V94`}/></g>)}
      {stars.flatMap((y)=>stars.map(x=><circle key={`${x}-${y}`} cx={6+x*step} cy={6+y*step} r={p.size===9?.56:.36}/>))}
    </svg>
    <div ref={ref} className="intersections" role={mini?undefined:'group'} aria-label={mini?undefined:`${p.size} 路棋盘`} onKeyDown={event=>{
      const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-p.size,ArrowDown:p.size}
      if(!(event.key in delta)) return
      event.preventDefault();const next=Math.min(p.board.length-1,Math.max(0,focus+delta[event.key]));setFocus(next)
      ref.current?.querySelector<HTMLButtonElement>(`[data-point="${next}"]`)?.focus()
    }}>
      {p.board.map((color,i)=>{
        const hint=suggestions.findIndex(c=>c.point===i),isDead=dead.includes(i),label=`${coordinate(i,p.size)}${color?(color===1?' 黑棋':' 白棋'): ' 空点'}`
        const style={left:`${6+(i%p.size)*step}%`,top:`${6+Math.floor(i/p.size)*step}%`,width:`${step*.98}%`,height:`${step*.98}%`}
        const contents=<>
          {ownership&&!color&&ownership[i]>0&&<span className={`territory territory-${ownership[i]}`}/>}
          {color>0&&<span className={`stone stone-${color} ${isDead?'dead':''} ${p.winningLine.includes(i)?'winning':''}`}>
            {last===i&&!mini&&<span className="last-dot"/>}{isDead&&<span className="dead-cross">×</span>}
          </span>}
          {!color&&hint>=0&&<span className="hint-ring">{suggestions.length>1?hint+1:''}</span>}
          {!color&&!disabled&&hint<0&&<span className={`stone stone-${p.turn} ghost`}/>}
        </>
        return mini?<span key={i} style={style} className="intersection">{contents}</span>:<button key={i} data-point={i} type="button" style={style} className="intersection" aria-label={label} aria-disabled={disabled} tabIndex={focus===i?0:-1} onFocus={()=>setFocus(i)} onClick={()=>{if(!disabled)onPlay(i)}}>{contents}</button>
      })}
    </div>
  </div>
}
