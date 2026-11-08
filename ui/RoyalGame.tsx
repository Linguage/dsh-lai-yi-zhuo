import { useEffect, useMemo, useState } from 'react'
import { IconButton, Modal, Toggle } from './App.tsx'
import { Icon } from './icons.tsx'
import { actRoyal, royalPosition, royalMoves, undoRoyal, restoreRoyal, royalKey, royalNames, royalSideName, pieceName, chessGlyph, squareName } from './royal.ts'
import type { RoyalKind, RoyalSession, RoyalMove, Side, RoyalPosition } from './royal.ts'
import { undoLimit, PREFS_KEY, readPreferences } from './storage.ts'
import type { Level } from './game.ts'

const levels=['启蒙','入门','练习','进阶','挑战']
function read(key:string){try{return localStorage.getItem(key)}catch{return null}}
export function RoyalBoard({position,human='w',selected=null,targets=[],hint=null,onPoint,disabled=false,mini=false}:{position:RoyalPosition;human?:Side;selected?:number|null;targets?:number[];hint?:RoyalMove|null;onPoint?:(point:number)=>void;disabled?:boolean;mini?:boolean}){
  const width=position.kind==='chess'?8:9,rows=position.kind==='chess'?8:10,points=Array.from({length:width*rows},(_,i)=>human==='w'?i:width*rows-i-1)
  return <div className={`royal-board ${position.kind}-board ${mini?'royal-mini':''}`} aria-label={royalNames[position.kind]}>
    {position.kind==='xiangqi'&&<svg className="xiangqi-lines" viewBox="0 0 90 100" aria-hidden="true"><path d={Array.from({length:10},(_,r)=>`M5 ${5+r*10}H85`).join(' ')+' '+Array.from({length:9},(_,c)=>`M${5+c*10} 5V45M${5+c*10} 55V95`).join(' ')+' M5 45V55M85 45V55 M35 5L55 25M55 5L35 25M35 75L55 95M55 75L35 95'}/><text x="22" y="52">楚 河</text><text x="57" y="52">漢 界</text></svg>}
    <div className="royal-cells" style={{gridTemplateColumns:`repeat(${width},1fr)`}}>{points.map((point,visual)=>{
      const p=position.board[point],white=p&&p===p.toUpperCase(),label=`${squareName(position.kind,point)} ${p?`${royalSideName(position.kind,white?'w':'b')}${pieceName(position.kind,p)}`:'空位'}`
      const cell=<>{p&&<span className={`royal-piece ${white?'light-piece':'dark-piece'}`}>{position.kind==='chess'?chessGlyph[p.toLowerCase()]:<span className="xiangqi-glyph">{pieceName(position.kind,p)}</span>}</span>}{!p&&targets.includes(point)&&<i className="legal-dot"/>}</>
      const className=`royal-cell ${(visual%width+Math.floor(visual/width))%2?'dark-square':'light-square'} ${selected===point?'selected-square':''} ${targets.includes(point)?'legal-square':''} ${hint&&(hint.from===point||hint.to===point)?'suggested-square':''} ${position.moves.at(-1)?.from===point||position.moves.at(-1)?.to===point?'last-square':''} ${p?.toLowerCase()==='k'&&position.checked&&((white?'w':'b')===position.turn)?'checked-king':''}`
      return mini?<span key={point} className={className}>{cell}</span>:<button type="button" key={point} className={className} aria-label={label} aria-pressed={selected===point} disabled={disabled} onClick={()=>onPoint?.(point)} onKeyDown={e=>{const offset=({ArrowRight:1,ArrowLeft:-1,ArrowDown:width,ArrowUp:-width} as Record<string,number>)[e.key];if(offset){e.preventDefault();const next=visual+offset;if(next>=0&&next<points.length)(e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus()}}}>{cell}</button>
    })}</div>
  </div>
}
export function RoyalGame({kind,onExit}:{kind:RoyalKind;onExit:()=>void}){
  const [session,setSession]=useState<RoyalSession>(()=>restoreRoyal(read(royalKey(kind)),kind)||{kind,human:'w',level:0,moves:[],undoStreak:0})
  const [setupHuman,setSetupHuman]=useState(session.human),[setupLevel,setSetupLevel]=useState(session.level)
  const [playing,setPlaying]=useState(false),[selected,setSelected]=useState<number|null>(null),[promotion,setPromotion]=useState<RoyalMove[]>([])
  const [prefs,setPrefs]=useState(()=>readPreferences(read(PREFS_KEY))),[menu,setMenu]=useState(false),[modal,setModal]=useState<'rules'|'restart'|'resign'|null>(null)
  const [analysis,setAnalysis]=useState<{move:RoyalMove|null;whiteEstimate:number}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[saveError,setSaveError]=useState(false)
  const position=useMemo(()=>royalPosition(session),[session]),legal=useMemo(()=>royalMoves(session),[session]),isHuman=position.turn===session.human,ended=position.phase==='finished',canSuggest=[1,2].includes(session.level)
  const remaining=undoLimit(session.level)-session.undoStreak,targets=legal.filter(m=>m.from===selected).map(m=>m.to)
  useEffect(()=>{if(!playing)return;try{localStorage.setItem(royalKey(kind),JSON.stringify(session))}catch{setSaveError(true)}},[session,playing,kind])
  useEffect(()=>{try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs))}catch{setSaveError(true)}},[prefs])
  useEffect(()=>{
    setSelected(null);setAnalysis(null);setError('');setPromotion([])
    if(!playing||ended||isHuman&&!prefs.winrate&&!(canSuggest&&prefs.suggestions))return
    let worker:Worker|null=null,cancelled=false,timer:ReturnType<typeof setTimeout>
    const fail=()=>{if(!cancelled){setError('计算中断，点击重试');worker?.terminate()}}
    const timeout=setTimeout(fail,15000)
    try{worker=new Worker(new URL('./royal.worker.ts',import.meta.url),{type:'module'});worker.onerror=fail;worker.onmessage=e=>{
      clearTimeout(timeout);if(cancelled)return;if(e.data.error||!e.data.move){fail();return}setAnalysis(e.data)
      if(!isHuman)timer=setTimeout(()=>{if(!cancelled)setSession(current=>current===session?actRoyal(current,e.data.move)||current:current)},350)
      worker?.terminate()
    };worker.postMessage({session,level:isHuman?2:session.level})}catch{fail()}
    return()=>{cancelled=true;clearTimeout(timeout);clearTimeout(timer);worker?.terminate()}
  },[session,playing,prefs.winrate,prefs.suggestions,canSuggest,ended,isHuman,retry])
  function commit(move:RoyalMove){const next=actRoyal(session,move);if(next)setSession(next);setPromotion([]);setSelected(null)}
  function point(i:number){if(!playing||!isHuman||ended)return;const matches=legal.filter(m=>m.from===selected&&m.to===i)
    if(matches.length>1){setPromotion(matches);return}if(matches.length){commit(matches[0]);return}
    const p=position.board[i];setSelected(p&&(p===p.toUpperCase()?'w':'b')===session.human?i:null)
  }
  function fresh(){setSetupHuman(session.human);setSetupLevel(session.level);setSession({...session,moves:[],undoStreak:0,resigned:undefined});setPlaying(false);setMenu(false);setModal(null)}
  const humanEstimate=analysis?(session.human==='w'?analysis.whiteEstimate:100-analysis.whiteEstimate):null
  return <main className="app game-screen royal-screen"><div className="table-frame"><header className="game-header"><div className="heading-group"><IconButton icon="back" label="返回棋桌" onClick={onExit}/><h1>{royalNames[kind]}</h1><span className="level-badge">{playing?session.level:setupLevel} 档</span></div>{playing&&prefs.winrate&&<span className="winrate" title="启发式实验估算，尚未校准">{ended?(position.winner===null?'和棋':position.winner===session.human?'100%':'0%'):humanEstimate===null?'估算中':`约 ${humanEstimate}%`}<small>实验</small></span>}</header>
    <div className={`play-layout ${!playing?'setting-up':''}`}>
      <div className="seat-area ai-seat"><div className={`seat ${playing&&!ended&&!isHuman?'is-active':''}`}><Icon name="robot"/><span className="royal-seat-label">{royalSideName(kind,session.human==='w'?'b':'w')}</span><i className="turn-dot"/></div></div>
      <div className="board-area"><RoyalBoard position={position} human={playing?session.human:setupHuman} selected={selected} targets={targets} hint={playing&&isHuman&&canSuggest&&prefs.suggestions?analysis?.move:null} onPoint={point} disabled={!playing||ended||!isHuman}/></div>
      <div className="seat-area human-seat"><div className={`seat ${playing&&!ended&&isHuman?'is-active':''}`}><Icon name="person"/><span className="royal-seat-label">{royalSideName(kind,session.human)}</span><i className="turn-dot"/></div></div>
      <div className="game-status" role="status">{error?<button onClick={()=>setRetry(n=>n+1)}>{error}</button>:playing&&!ended?position.checked?'将军':session.level===0?'先选棋子，再点亮起的位置':canSuggest&&prefs.suggestions&&analysis?.move&&isHuman?'亮边标出建议走法':null:null}</div>
      {!playing?<div className="setup-panel"><div className="stone-tray">{(['w','b'] as Side[]).map(side=><button key={side} className={`color-choice ${setupHuman===side?'selected':''}`} aria-label={`执${royalSideName(kind,side)}`} aria-pressed={setupHuman===side} onClick={()=>setSetupHuman(side)}><span className={`royal-piece ${side==='w'?'light-piece':'dark-piece'}`}>{kind==='chess'?chessGlyph[side==='w'?'K':'k']:<span className="xiangqi-glyph">{side==='w'?'帅':'将'}</span>}</span><span>{royalSideName(kind,side)} · {side==='w'?'先行':'后行'}</span></button>)}</div>
        <div className="difficulty">{([0,1,2,3,4] as Level[]).map(level=><button key={level} aria-label={`${level} 档 ${levels[level]}`} aria-pressed={setupLevel===level} onClick={()=>setSetupLevel(level)}><b>{level}</b><span>{levels[level]}</span></button>)}</div>
        <button className="primary-button" onClick={()=>{setSession({kind,human:setupHuman,level:setupLevel,moves:[],undoStreak:0});setPlaying(true)}}>开始对弈 <Icon name="chevron"/></button>
        {(session.moves.length>0||session.undoStreak>0)&&!ended&&<button className="resume-button" onClick={()=>setPlaying(true)}>继续上次的{royalNames[kind]}</button>}
      </div>:<div className="actions-area">{ended&&<div className="result-panel"><h2>{position.winner===null?'和棋':position.winner===session.human?'你赢了':'AI 获胜'}</h2><p>{position.reason}</p><button className="primary-button" onClick={fresh}>再来一局</button></div>}
        <div className="toolbar"><IconButton icon="book" label="规则" onClick={()=>setModal('rules')}/>{undoLimit(session.level)>0&&<IconButton icon="undo" label={`悔棋（剩余 ${remaining} 次）`} count={remaining} disabled={ended||!remaining||session.moves.length< (session.human==='w'?1:2)} onClick={()=>setSession(undoRoyal(session))}/>}{canSuggest&&<IconButton icon="bulb" label={prefs.suggestions?'关闭下棋建议':'开启下棋建议'} active={prefs.suggestions} onClick={()=>setPrefs({...prefs,suggestions:!prefs.suggestions})}/>}
        <div className="menu-anchor"><IconButton icon="more" label="更多" active={menu} onClick={()=>setMenu(!menu)}/>{menu&&<div className="settings-menu"><Toggle label="胜率估算" value={prefs.winrate} onChange={()=>setPrefs({...prefs,winrate:!prefs.winrate})}/><p className="estimate-note">实验估算，尚未校准</p><button className="menu-item" onClick={()=>{setModal('restart');setMenu(false)}}>重新开局</button>{!ended&&<button className="menu-item" onClick={()=>{setModal('resign');setMenu(false)}}>认输</button>}</div>}</div></div>
      </div>}
    </div>{saveError&&<p className="storage-notice">当前环境无法保存对局。</p>}
    {promotion.length>0&&<Modal title="选择升变棋子" onClose={()=>setPromotion([])}><div className="promotion-choices">{promotion.map(m=><button key={m.promotion} aria-label={`升变为${pieceName('chess',m.promotion!)}`} onClick={()=>commit(m)}>{chessGlyph[session.human==='w'?m.promotion!.toUpperCase():m.promotion!]}<small>{pieceName('chess',m.promotion!)}</small></button>)}</div></Modal>}
    {modal==='rules'&&<Modal title={royalNames[kind]} onClose={()=>setModal(null)}><div className="rules-content">{kind==='xiangqi'?<><p>红先黑后。车走直线，炮隔一个棋子吃子，马走日且不能蹩腿，象走田且不能塞眼、不能过河。士与将帅不能出九宫；兵卒前进，过河后可横走，不能后退。</p><p>不能让己方将帅被攻击，也不能让将帅直接照面。将死或无合法走法判负。单方长将三次重复判负，其余三次重复、60 回合无吃子自动和棋。本练习版暂不裁定复杂长捉争议。</p></>:<><p>白先黑后。先选棋子，再点目标格。支持王车易位、吃过路兵，以及兵到末排后选择后、车、象或马升变。</p><p>不能让自己的王受攻击。将死获胜；逼和、规则库识别的子力不足、三次重复与 50 回合无吃子无走兵自动和棋。重复与 50 回合在本陪练版自动处理。</p></>}<p>0 档可连续悔棋两次，1 档一次；合法新走法恢复回退深度。1、2 档可开启建议。对局自动保存在本机。</p><p className="engine-note">本地搜索 AI，档位未标定为人类段位。胜率是可关闭的启发式实验估算。</p></div></Modal>}
    {modal==='restart'&&<Modal title="重新开局？" onClose={()=>setModal(null)}><div className="modal-actions"><button onClick={()=>setModal(null)}>继续本局</button><button className="primary-button" onClick={fresh}>重新开局</button></div></Modal>}
    {modal==='resign'&&<Modal title="确认认输？" onClose={()=>setModal(null)}><div className="modal-actions"><button onClick={()=>setModal(null)}>继续本局</button><button className="primary-button" onClick={()=>{setSession({...session,resigned:session.human});setModal(null)}}>认输</button></div></Modal>}
  </div></main>
}
