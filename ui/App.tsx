import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Board } from './Board.tsx'
import { Icon } from './icons.tsx'
import type { IconName } from './icons.tsx'
import { createGame, play, other, areaScore, finishScore, groupAt, resign, ruleTip, colorName } from './game.ts'
import type { Kind, Color, Level, Position } from './game.ts'
import type { Analysis } from './ai.ts'
import { restore, encode, readPreferences, undoLimit, SESSION_KEY, PREFS_KEY } from './storage.ts'
import type { Session } from './storage.ts'

const titles={gomoku:'五子棋',go:'围棋'},levelNames=['启蒙','入门','练习','进阶','挑战']
function read(key:string) {try{return localStorage.getItem(key)}catch{return null}}
const newSession=(kind:Kind):Session=>({position:createGame(kind),human:1,level:0,history:[],dead:[],undoStreak:0})
export function IconButton({icon,label,onClick,active=false,disabled=false,count}:{icon:IconName;label:string;onClick:()=>void;active?:boolean;disabled?:boolean;count?:number}) {
  return <button type="button" className={`icon-button ${active?'active':''}`} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}><Icon name={icon}/>{count!==undefined&&<small className="icon-count" aria-hidden="true">{count}</small>}</button>
}
export function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:()=>void}) {
  return <button type="button" className="toggle-row" role="switch" aria-checked={value} onClick={onChange}><span>{label}</span><span className={`switch ${value?'on':''}`}><span/></span></button>
}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>{el?.close()}},[])
  return <dialog ref={dialog} className="modal" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal-head"><h2>{title}</h2><IconButton icon="close" label="关闭" onClick={onClose}/></div>{children}
  </dialog>
}
function Seat({human,color,active,thinking,captures}:{human:boolean;color:Color;active:boolean;thinking?:boolean;captures?:number}) {
  return <div className={`seat-area ${human?'human-seat':'ai-seat'}`}>
    <div className={`seat ${active?'is-active':''} ${thinking?'thinking':''}`} aria-label={`${human?'你':'AI'}，执${color===1?'黑':'白'}${active?'，当前回合':''}`}>
      <Icon name={human?'person':'robot'}/><span className="seat-divider"/><span className={`stone stone-${color}`}/><span className="turn-dot"/>
    </div>
    {!!captures&&<span className="capture-count" title="提子数">提 {captures}</span>}
  </div>
}
function miniature(kind:Kind):Position {
  const p=createGame('go',9);p.kind=kind
  const stones=kind==='gomoku'?[[21,1],[31,1],[41,1],[51,1],[30,2],[40,2],[32,2]]:[[20,1],[21,1],[29,1],[38,1],[22,2],[31,2],[40,2],[58,2],[60,1]]
  stones.forEach(([i,c])=>p.board[i]=c as Color);return p
}
export function App({onExit,onRoyal}:{onExit?:()=>void;onRoyal?:(kind:'xiangqi'|'chess')=>void}) {
  const [screen,setScreen]=useState<'home'|'setup'|'play'>('home')
  const [session,setSession]=useState<Session|null>(()=>restore(read(SESSION_KEY)))
  const [prefs,setPrefs]=useState(()=>readPreferences(read(PREFS_KEY)))
  const [menu,setMenu]=useState(false),[modal,setModal]=useState<'rules'|'restart'|'resign'|null>(null)
  const [analysis,setAnalysis]=useState<Analysis|null>(null)
  const [notice,setNotice]=useState(''),[storageError,setStorageError]=useState(false),[engineError,setEngineError]=useState(''),[retry,setRetry]=useState(0)
  const audio=useRef<AudioContext|null>(null),menuRef=useRef<HTMLDivElement>(null)
  const position=session?.position,canSuggest=!!session&&[1,2].includes(session.level)
  const undosLeft=session?undoLimit(session.level)-session.undoStreak:0
  const isHuman=!!session&&position?.turn===session.human
  const thinking=screen==='play'&&position?.phase==='playing'&&!isHuman
  const suggestions=canSuggest&&prefs.suggestions&&isHuman&&position?.phase==='playing'?(analysis?.suggestions.slice(0,session?.level===1?1:2)||[]):[]
  const playSound=()=>{
    if(!prefs.sound) return
    try {
      const ac=audio.current||(audio.current=new AudioContext());void ac.resume()
      const oscillator=ac.createOscillator(),gain=ac.createGain()
      oscillator.type='triangle';oscillator.frequency.setValueAtTime(620,ac.currentTime);oscillator.frequency.exponentialRampToValueAtTime(170,ac.currentTime+.055)
      gain.gain.setValueAtTime(.055,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.075)
      oscillator.connect(gain);gain.connect(ac.destination);oscillator.start();oscillator.stop(ac.currentTime+.08)
    } catch {/* Sound is optional when the host disallows audio. */}
  }
  useEffect(()=>{
    try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs))}catch{setStorageError(true)}
  },[prefs])
  useEffect(()=>{
    if(screen!=='play'||!session) return
    try{localStorage.setItem(SESSION_KEY,encode(session))}catch{setStorageError(true)}
  },[session,screen])
  useEffect(()=>{
    if(!notice)return
    const timeout=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timeout)
  },[notice])
  useEffect(()=>{
    if(!menu)return
    const close=(e:PointerEvent)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(false)}
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)}
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)}
  },[menu])
  useEffect(()=>{
    setAnalysis(null);setEngineError('')
    if(screen!=='play'||!session||session.position.phase!=='playing') return
    const p=session.position,ai=p.turn!==session.human
    if(!ai&&!prefs.winrate&&!(canSuggest&&prefs.suggestions)) return
    let worker:Worker|null=null,timer:ReturnType<typeof setTimeout>|undefined,timeout:ReturnType<typeof setTimeout>|undefined,cancelled=false
    try {
      worker=new Worker(new URL('./engine.worker.ts',import.meta.url),{type:'module'})
      const fail=()=>{if(!cancelled){setEngineError('计算中断，可以重试');worker?.terminate()}}
      timeout=setTimeout(fail,12000)
      worker.onerror=fail
      worker.onmessage=(event:MessageEvent<{analysis?:Analysis;error?:string}>)=>{
        if(cancelled)return
        clearTimeout(timeout)
        if(event.data.error||!event.data.analysis){fail();return}
        const result=event.data.analysis;setAnalysis(result)
        if(ai) timer=setTimeout(()=>{
          if(cancelled)return
          const next=play(p,result.move)
          if(next.error){setEngineError('对手落子校验失败，请重试');return}
          setSession(current=>current?.position===p?{...current,history:[...current.history,p],position:next.state}:current)
        },Math.max(0,400-result.elapsed))
        worker?.terminate()
      }
      worker.postMessage({state:p,level:ai?session.level:2})
    } catch {setEngineError('无法启动计算线程，请重试')}
    return()=>{cancelled=true;clearTimeout(timer);clearTimeout(timeout);worker?.terminate()}
  },[position,session?.level,session?.human,screen,prefs.winrate,prefs.suggestions,canSuggest,retry])
  function commit(point:number|null) {
    if(!session||!isHuman||position?.phase!=='playing') return
    const result=play(session.position,point)
    if(result.error){setNotice(result.error);return}
    if(point!==null)playSound()
    setSession({...session,history:[...session.history,session.position],position:result.state,undoStreak:0})
  }
  function onPoint(point:number) {
    if(!session)return
    if(session.position.phase==='scoring') {
      if(!session.position.board[point])return
      const group=[...groupAt(session.position.board,point,session.position.size).stones],unmark=session.dead.includes(point)
      setSession({...session,dead:unmark?session.dead.filter(n=>!group.includes(n)):[...new Set([...session.dead,...group])]});return
    }
    if(!isHuman||session.position.phase!=='playing')return
    if(session.position.board[point]){setNotice('这里已经有棋子了');return}
    commit(point)
  }
  function select(kind:Kind) {setSession(newSession(kind));setMenu(false);setScreen('setup')}
  function back() {setMenu(false);setNotice('');if(screen==='setup')setSession(restore(read(SESSION_KEY)));setScreen('home')}
  function undo() {
    setSession(current=>{
      if(!current||current.position.phase==='finished'||current.undoStreak>=undoLimit(current.level)) return current
      let index=current.history.length-1
      while(index>=0&&current.history[index].turn!==current.human) index--
      if(index<0) return current
      return {...current,position:current.history[index],history:current.history.slice(0,index),dead:[],undoStreak:current.undoStreak+1}
    })
    setNotice('')
  }
  function restart() {if(!session)return;setSession({...session,position:createGame(session.position.kind,session.position.size),history:[],dead:[],undoStreak:0});setModal(null);setMenu(false);setScreen('setup')}
  const score=position&&(position.phase==='scoring'||(position.phase==='finished'&&position.kind==='go'&&!position.reason.endsWith('认输')))?areaScore(position,session?.dead):null
  const estimate=position?.phase==='finished'?(position.winner===0?50:position.winner===session?.human?100:0):analysis?(session?.human===1?analysis.blackWinrate:100-analysis.blackWinrate):null

  return <main className={`app ${screen==='home'?'home-screen':'game-screen'}`}>
    <div className="table-frame">
      {screen==='home'?<section className="home-content">
        {onExit&&<div className="chess-home-back"><IconButton icon="back" label="返回选桌" onClick={onExit}/></div>}
        <div className="brand-mark"><span className="stone stone-1"/><span className="stone stone-2"/></div>
        <p className="eyebrow">一方棋盘 · 一段闲暇</p><h1>棋桌</h1><p className="home-subtitle">落一子，慢慢来。</p>
        <div className={`game-choices ${onRoyal?'expanded-chess-choices':''}`}>{(['gomoku','go'] as Kind[]).map(kind=><button key={kind} className="game-choice" onClick={()=>select(kind)} aria-label={`选择${titles[kind]}`}>
          <Board position={miniature(kind)} onPlay={()=>{}} mini disabled/><div className="choice-caption"><h2>{titles[kind]}</h2><Icon name="chevron"/></div>
        </button>)}{onRoyal&&(['xiangqi','chess'] as const).map(kind=><button key={kind} className="game-choice" onClick={()=>onRoyal(kind)} aria-label={`选择${kind==='xiangqi'?'中国象棋':'国际象棋'}`}><div className={`royal-choice-art ${kind}-choice-art`} aria-hidden="true"><span>{kind==='xiangqi'?<span className="xiangqi-glyph">帥</span>:'♔'}</span><span>{kind==='xiangqi'?<span className="xiangqi-glyph">將</span>:'♞'}</span></div><div className="choice-caption"><h2>{kind==='xiangqi'?'中国象棋':'国际象棋'}</h2><Icon name="chevron"/></div></button>)}</div>
        {session&&session.position.phase!=='finished'&&(session.position.moves.length>0||session.undoStreak>0)&&<button className="resume-button" onClick={()=>setScreen('play')}><Icon name="refresh"/>继续上次的{titles[session.position.kind]}<span>第 {session.position.moves.length} 手</span></button>}
        <div className="home-footer"><span className="small-dot"/>人机对弈<span className="footer-divider"/>本地保存</div>
      </section>:session&&position&&<>
        <header className="game-header"><div className="heading-group"><IconButton icon="back" label="返回棋桌" onClick={back}/><h1>{titles[position.kind]}</h1><span className="level-badge" title={`${levelNames[session.level]}难度`}>{position.size} 路 <span>·</span> {session.level} 档</span></div>
          <div className="header-end">{screen==='play'&&prefs.winrate&&<button className="winrate" title="本地启发式实验估算，尚未经过实战校准，不代表你的真实获胜概率。" onClick={()=>{setMenu(true)}}><span className={`stone stone-${session.human}`}/><span>{estimate===null?'估算中':`约 ${estimate}%`}</span><small>实验</small></button>}
            {screen==='play'&&<span className="move-number">第 {position.moves.length+Number(position.phase==='playing')} 手</span>}</div>
        </header>
        <div className={`play-layout ${screen==='setup'?'setting-up':''}`}>
          <Seat human={false} color={other(session.human)} active={screen==='play'&&position.phase==='playing'&&!isHuman} thinking={thinking&&!engineError} captures={position.captures[other(session.human)-1]}/>
          <div className="board-area"><Board position={position} onPlay={onPoint} disabled={screen==='setup'||position.phase==='finished'||(position.phase==='playing'&&!isHuman)} suggestions={suggestions} dead={session.dead} ownership={score?.ownership}/></div>
          <Seat human color={session.human} active={screen==='play'&&position.phase==='playing'&&isHuman} captures={position.captures[session.human-1]}/>
          <div className="game-status" role="status" aria-live="polite">
            {notice?<span className="status-chip">{notice}</span>:engineError?<button className="status-chip error" onClick={()=>setRetry(v=>v+1)}>{engineError} ↻</button>:screen==='play'&&position.phase==='playing'&&session.level===0?<span className="rule-tip"><Icon name="book"/>{ruleTip(position)}</span>:null}
            {screen==='play'&&position.phase==='playing'&&suggestions.length>0&&<span className="suggestion-tip"><Icon name="bulb"/>{suggestions[0].reason}</span>}
            <span className="sr-only">{thinking?'AI 正在思考':isHuman?'轮到你落子':''}</span>
          </div>
          {screen==='setup'?<div className="setup-panel">
            <div className="setup-top"><span>选择执子</span>{position.kind==='go'&&<div className="size-selector" aria-label="棋盘尺寸">{[9,19].map(size=><button key={size} aria-pressed={position.size===size} onClick={()=>setSession({...session,position:createGame('go',size)})}>{size} 路</button>)}</div>}</div>
            <div className="stone-tray">{([1,2] as Color[]).map(c=><button key={c} className={`color-choice ${session.human===c?'selected':''}`} onClick={()=>setSession({...session,human:c})} aria-label={`执${c===1?'黑':'白'}`} aria-pressed={session.human===c}><span className={`stone stone-${c}`}/><span>{c===1?'执黑 · 先行':'执白 · 后行'}</span><span className="selection-dot"/></button>)}</div>
            <div className="difficulty" aria-label="难度">{([0,1,2,3,4] as Level[]).map(level=><button key={level} aria-label={`${level} 档 ${levelNames[level]}`} aria-pressed={session.level===level} onClick={()=>setSession({...session,level})}><b>{level}</b><span>{levelNames[level]}</span></button>)}</div>
            <p className="setup-note">{session.level===0?'带规则提示':session.level<=2?'可开启落子建议':'专心对弈'}</p>
            <button className="primary-button" onClick={()=>{setScreen('play');setNotice('')}}>开始对弈 <Icon name="chevron"/></button>
          </div>:<div className="actions-area">
            {position.phase==='scoring'?<div className="scoring-panel"><p>点选死子，确认数子</p><div className="score-line"><span>黑 {score?.black}</span><span>白 {score?.white} + 7.5</span></div><div className="scoring-actions"><button onClick={()=>{setSession({...session,position:{...position,phase:'playing',passes:0,reason:''},dead:[]})}}>继续下</button><button className="primary-button" onClick={()=>setSession({...session,position:finishScore(position,session.dead)})}>确认结果</button></div></div>:position.phase==='finished'?<div className="result-panel" role="status"><span className="result-eyebrow">本局结束</span><h2>{position.winner===0?'和棋':position.winner===session.human?'你赢了':'AI 获胜'}</h2><p>{position.reason}</p>{score&&<small>黑 {score.black} · 白 {score.white} + 7.5</small>}<button className="primary-button" onClick={restart}>再来一局 <Icon name="refresh"/></button></div>:null}
            <div className="toolbar">
              <IconButton icon="book" label="规则" onClick={()=>setModal('rules')}/>
              {undoLimit(session.level)>0&&<IconButton icon="undo" label={`悔棋（剩余 ${undosLeft} 次）`} count={undosLeft} onClick={undo} disabled={undosLeft===0||!session.history.some(p=>p.turn===session.human)||position.phase==='finished'}/>}
              {canSuggest&&<IconButton icon="bulb" label={prefs.suggestions?'关闭下棋建议':'开启下棋建议'} active={prefs.suggestions} onClick={()=>setPrefs({...prefs,suggestions:!prefs.suggestions})} disabled={position.phase!=='playing'}/>}
              {position.kind==='go'&&<IconButton icon="pass" label="停一手" onClick={()=>commit(null)} disabled={!isHuman||position.phase!=='playing'}/>}
              <div className="menu-anchor" ref={menuRef}><IconButton icon="more" label="更多" active={menu} onClick={()=>setMenu(v=>!v)}/>
                {menu&&<div className="settings-menu" aria-label="对局设置"><Toggle label="胜率估算" value={prefs.winrate} onChange={()=>setPrefs({...prefs,winrate:!prefs.winrate})}/><p className="estimate-note">实验估算，尚未校准</p>
                  {canSuggest&&<Toggle label="下棋建议" value={prefs.suggestions} onChange={()=>setPrefs({...prefs,suggestions:!prefs.suggestions})}/>}
                  <Toggle label="落子音效" value={prefs.sound} onChange={()=>setPrefs({...prefs,sound:!prefs.sound})}/><div className="menu-separator"/>
                  <button className="menu-item" onClick={()=>{setModal('restart');setMenu(false)}}><Icon name="refresh"/>重新开局</button>
                  {position.phase==='playing'&&<button className="menu-item" onClick={()=>{setModal('resign');setMenu(false)}}><Icon name="flag"/>认输</button>}
                </div>}
              </div>
            </div>
          </div>}
        </div>
      </>}
      {storageError&&<p className="storage-notice" role="status">当前环境无法保存棋局，关闭页面后进度会丢失。</p>}
    </div>
    {modal==='rules'&&session&&<Modal title={titles[session.position.kind]} onClose={()=>setModal(null)}><div className="rules-content">{session.position.kind==='gomoku'?<><p>黑棋先行，双方轮流在交叉点落一子。</p><p>横、竖或斜向，先连成五颗或更多同色棋子即胜。采用自由五子棋，不设禁手。满盘无胜方则和棋。</p></>:<><p>黑棋先行。棋子上下左右相邻的空点是「气」，相连棋子共享气。没有气的棋子会被提走。</p><p>不能落在已有棋子的位置，不能自杀，也不能落子重现之前出现过的盘面。</p><p>双方连续停一手后进入数子。点选整组死子，再确认结果；有疑问可以继续下。</p><p>按面积数子，棋子和仅由己方包围的空点合计，白贴 7.5 点。双方都接触的空地不计入任何一方。</p></>}
      <div className="rules-divider"/><p>0 档显示规则提示，1、2 档可点灯泡开启落子建议。亮点表示当前回合，小圆点标记上一手。</p><p>0 档可连续悔棋两手，1 档一手，2–4 档不可悔棋。你走出新的一手后，重新计算可悔棋的手数。</p><p className="engine-note">首版采用本地搜索陪练。档位代表计算强度，尚未标定为人类棋力；胜率为启发式实验估算，不是经过校准的获胜概率。</p></div></Modal>}
    {modal==='restart'&&<Modal title="重新开局？" onClose={()=>setModal(null)}><p>当前棋局将被替换，你可以重新选择执子和难度。</p><div className="modal-actions"><button onClick={()=>setModal(null)}>继续本局</button><button className="primary-button" onClick={restart}>重新开局</button></div></Modal>}
    {modal==='resign'&&session&&<Modal title="确认认输？" onClose={()=>setModal(null)}><div className="modal-actions"><button onClick={()=>setModal(null)}>继续下</button><button className="primary-button" onClick={()=>{setSession({...session,position:resign(session.position,session.human)});setModal(null)}}>认输</button></div></Modal>}
  </main>
}
