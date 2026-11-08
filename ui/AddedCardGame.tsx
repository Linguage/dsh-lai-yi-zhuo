import { useEffect, useMemo, useRef, useState } from 'react'
import { IconButton,Modal,Toggle } from './App.tsx'
import { Icon } from './icons.tsx'
import { FourSeat,PlayingCard,seatNames } from './TablePieces.tsx'
import { cardLabel } from './guandan.ts'
import type { SeatId } from './guandan.ts'
import { classifyClimb,climbBeats,climbSeats,climbTeam,observeClimb } from './climbing.ts'
import { declarations,observeTractor,tractorPlayError,sortTractor,trumpName,category } from './tractor.ts'
import { newCardsSession,actCardsSession,restoreCardsSession,encodeCardsSession,undoCardsSession,addedCardKey,addedCardNames } from './cards-session.ts'
import type { AddedCardKind,AddedCardAction } from './cards-session.ts'
import type { Level } from './game.ts'
import { undoLimit } from './storage.ts'
const levels=['启蒙','入门','练习','进阶','挑战']
function read(key:string){try{return localStorage.getItem(key)}catch{return null}}
const labels={doudizhu:'三人 · 叫分',shuangkou:'普通 · 无百搭',tractor:'双升 · 单副打 2'}
export function AddedCardGame({kind,onExit}:{kind:AddedCardKind;onExit:()=>void}){
  const [session,setSession]=useState(()=>restoreCardsSession(read(addedCardKey(kind)),kind)||newCardsSession(kind,0)),[playing,setPlaying]=useState(false),[level,setLevel]=useState<Level>(session.level)
  const [selected,setSelected]=useState<number[]>([]),[key,setKey]=useState(''),[suggestions,setSuggestions]=useState(false),[menu,setMenu]=useState(false),[modal,setModal]=useState<'rules'|'restart'|null>(null)
  const [hint,setHint]=useState<AddedCardAction|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0),[saveError,setSaveError]=useState(false)
  const drag=useRef<{card:number;x:number;y:number;select:boolean;moved:boolean}|null>(null),swiped=useRef(false)
  const state=session.state,human=state.turn===0,ended=state.phase==='finished',canSuggest=[1,2].includes(session.level),remaining=undoLimit(session.level)-session.undoStreak
  const seats=kind==='doudizhu'?climbSeats(kind):[0,1,2,3] as SeatId[],hand=state.kind==='tractor'?sortTractor(state.hands[0],state.trump,state.levelRank):state.hands[0]
  const matches=useMemo(()=>state.kind!=='tractor'?classifyClimb(selected,state.kind).filter(m=>climbBeats(m,state.last?.move||null)):[],[state,selected])
  const move=matches.find(m=>m.key===key)||matches[0]
  const selectionValid=state.kind==='tractor'?state.phase==='bury'?selected.length===8:state.phase==='playing'&&!tractorPlayError(observeTractor(state,0),selected):!!move
  const hinted=hint&&'cards'in hint&&hint.cards?hint.cards:[]
  useEffect(()=>{if(!playing)return;try{localStorage.setItem(addedCardKey(kind),encodeCardsSession(session))}catch{setSaveError(true)}},[session,playing,kind])
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3000);return()=>clearTimeout(t)},[notice])
  useEffect(()=>{
    setSelected([]);setKey('');setHint(null);setError('')
    if(!playing||ended||human&&!(suggestions&&canSuggest))return
    let cancelled=false,worker:Worker|null=null,timer:ReturnType<typeof setTimeout>
    const fail=()=>{if(!cancelled){setError('计算中断，点击重试');worker?.terminate()}}
    const watchdog=setTimeout(fail,15000)
    try{worker=new Worker(new URL('./cards.worker.ts',import.meta.url),{type:'module'});worker.onerror=fail;worker.onmessage=e=>{clearTimeout(watchdog);if(cancelled)return;if(e.data.error||!e.data.action){fail();return}
      if(human)setHint(e.data.action);else timer=setTimeout(()=>{if(!cancelled)setSession(current=>{if(current.state!==state)return current;const n=actCardsSession(current,state.turn,e.data.action);if(n.error)setError(n.error);return n.session})},450)
      worker?.terminate()
    };worker.postMessage({kind,observation:state.kind==='tractor'?observeTractor(state,state.turn):observeClimb(state,state.turn),level:human?3:session.level})}catch{fail()}
    return()=>{cancelled=true;clearTimeout(watchdog);clearTimeout(timer);worker?.terminate()}
  },[state,playing,human,ended,suggestions,canSuggest,session.level,kind,retry])
  function act(action:AddedCardAction){if(!playing||!human||ended)return;const next=actCardsSession(session,0,action);if(next.error){setNotice(next.error);return}setSession(next.session);setNotice('')}
  function select(card:number){setSelected(s=>s.includes(card)?s.filter(c=>c!==card):[...s,card])}
  function pointerMove(e:React.PointerEvent){const d=drag.current;if(!d||Math.hypot(e.clientX-d.x,e.clientY-d.y)<8)return
    const mark=(card:number)=>setSelected(s=>d.select?[...new Set([...s,card])]:s.filter(c=>c!==card))
    if(!d.moved){d.moved=true;mark(d.card)}const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-card]');if(target?.dataset.card)mark(Number(target.dataset.card))
  }
  const humanTurn=playing&&human&&!ended,role=state.kind==='tractor'?'庄家':state.kind==='doudizhu'?'地主':'同伴'
  const roleSeat=state.kind==='tractor'?state.dealer:state.kind==='doudizhu'?state.landlord:2
  const displays=state.kind==='tractor'?(state.trick.length?state.trick:state.lastTrick):null
  const rank=state.kind==='shuangkou'?state.order.indexOf(0)+1:0
  let tip=''
  if(hint&&canSuggest&&suggestions&&human)tip=hint.type==='bid'?hint.value?`建议叫 ${hint.value} 分`:'建议不叫':hint.type==='declare'?hint.cards?'建议亮出高亮级牌':'建议不亮':hint.type==='bury'?'建议扣下高亮的 8 张牌':hint.cards?'亮边标出建议出牌':'建议不出'
  else if(session.level===0&&playing&&!ended)tip=state.phase==='bidding'?state.kind==='tractor'?'亮级牌定主，对家同队':'叫分最高者当地主':state.phase==='bury'?'庄家选 8 张牌扣底':state.kind==='tractor'?'有首引花色必须先跟，有对子需跟对子':'点选或划选手牌，再点出牌'
  return <main className={`app four-screen guandan-screen added-card-screen ${kind==='doudizhu'?'three-seats':''} ${playing?'four-playing':'four-setup'}`}><div className="table-frame">
    <header className="game-header"><div className="heading-group"><IconButton icon="back" label="返回牌桌" onClick={onExit}/><h1>{addedCardNames[kind]}</h1><span className="level-badge">{playing?session.level:level} 档</span></div><span className="table-mode">{labels[kind]}</span></header>
    <div className="four-layout"><div className="table-stage"><div className="four-square felt-guandan" data-testid="square-table"><div className="felt-inlay"/>
      {seats.filter(s=>s!==0).map(seat=><div key={seat} className={`opponent-hand opponent-${seat}`} aria-hidden="true">{Array.from({length:Math.min(5,state.hands[seat].length)},(_,i)=><PlayingCard key={i} back small wild={false}/>)}</div>)}
      <div className="table-center">{state.kind==='tractor'?<><b className="trump-label">{state.phase==='bidding'?'亮主':trumpName(state.trump)}</b><small className="public-reference">抓分 {state.points} / 80</small>{state.phase==='bury'&&<span className="lead-label">扣底</span>}</>:state.kind==='doudizhu'?<><div className="public-bottom">{state.bottom.map(c=><PlayingCard key={c} card={c} small back={state.phase==='bidding'} wild={false}/>)}</div><small className="public-reference">{state.phase==='bidding'?'叫分':`${state.base} 分 × ${state.multiplier}`}</small></>:<span className="felt-emblem">♣</span>}</div>
      {seats.map(seat=>{const display=state.kind==='tractor'?displays!.find(p=>p.seat===seat)?.cards:state.plays[seat];return display&&<div className={`table-play play-${seat}`} key={seat}>{display==='pass'?<span className="pass-label">不出</span>:<div className="played-cards">{(Array.isArray(display)?display:display.cards).map(c=><PlayingCard key={c} card={c} small wild={false}/>)}</div>}</div>})}
      {state.kind==='doudizhu'&&state.phase==='bidding'&&seats.map(seat=>state.bids[seat]!==null&&<span key={seat} className={`bid-marker bid-${seat}`}>{state.bids[seat]===0?'不叫':`${state.bids[seat]} 分`}</span>)}
      {seats.map(seat=><FourSeat key={seat} seat={seat} active={playing&&!ended&&state.turn===seat} team={kind!=='doudizhu'} count={state.hands[seat].length} finished={state.kind==='shuangkou'?state.order.indexOf(seat)+1:undefined}/>)}
      {roleSeat!==null&&state.phase!=='bidding'&&<span className={`role-marker role-${roleSeat}`}>{role}</span>}
    </div></div>
    {!playing?<section className="four-setup-panel"><h2>{kind==='doudizhu'?'一位地主，两位农民':'同伴坐在对面'}</h2><p>{kind==='tractor'?'亮主、扣底、跟牌、抓分':kind==='shuangkou'?'四人两副牌 · 普通双扣':'三人一副牌 · 叫分定地主'}</p><div className="difficulty">{([0,1,2,3,4] as Level[]).map(n=><button key={n} aria-label={`${n} 档 ${levels[n]}`} aria-pressed={level===n} onClick={()=>setLevel(n)}><b>{n}</b><span>{levels[n]}</span></button>)}</div><p className="setup-note">{level===0?'规则提示 · 连续回退两步':level===1?'可开建议 · 回退一步':level===2?'可开建议':'专心对局'}</p><button className="primary-button" onClick={()=>{setSession(newCardsSession(kind,level));setPlaying(true)}}>开始练习 <Icon name="chevron"/></button>{(session.actions.length>0||session.undoStreak>0)&&!ended&&<button className="resume-button" onClick={()=>setPlaying(true)}>继续上次的{addedCardNames[kind]}</button>}<button className="text-rule" onClick={()=>setModal('rules')}>规则 <Icon name="book"/></button></section>:
    <section className="player-dock">
      {ended?<div className="four-result" role="status"><span>本局结束</span><h2>{state.winner===null?'平扣':state.kind==='tractor'?state.winner===0?'你们赢了':'对方获胜':climbTeam(state,0)===state.winner?'你们赢了':'对方获胜'}</h2><p>{state.reason}</p>{state.kind!=='tractor'&&<div className="score-chips">{seats.map(seat=><span key={seat}>{seatNames[seat]} {state.scores[seat]>0?'+':''}{state.scores[seat]}</span>)}</div>}<button className="primary-button" onClick={()=>{setPlaying(false);setLevel(session.level)}}>再来一局</button></div>:
      <div className="table-actions" aria-label="当前可用操作">
        {state.phase==='bidding'?state.kind==='doudizhu'?<>{[0,1,2,3].map(value=><button className={value===3?'primary-button':'quiet-action'} key={value} disabled={!humanTurn||value!==0&&value<=Math.max(...state.bids.map(b=>b||0))} onClick={()=>act({type:'bid',value})}>{value?`${value} 分`:'不叫'}</button>)}</>:state.kind==='tractor'?<><button className="quiet-action" disabled={!humanTurn} onClick={()=>act({type:'declare',cards:null})}>不亮</button>{declarations(state.hands[0]).filter(d=>d.strength>(state.bid?.strength||0)).map((d,i)=><button key={i} className="claim-button" disabled={!humanTurn} onClick={()=>act({type:'declare',cards:d.cards})}>{trumpName(d.suit)}{d.cards.length===2?' · 双张':''}</button>)}</>:null:
          <>{state.kind!=='tractor'&&<button className="quiet-action" disabled={!humanTurn||!state.last} onClick={()=>act({type:'play',cards:null})}>不出</button>}<button className="primary-button" disabled={!humanTurn||!selectionValid} onClick={()=>act(state.phase==='bury'?{type:'bury',cards:selected}:{type:'play',cards:selected,...(state.kind!=='tractor'?{key:move?.key}:{})})}>{state.phase==='bury'?`扣底 ${selected.length}/8`:'出牌'}</button>{matches.length>1&&<select className="shape-select" aria-label="选择牌型" value={move?.key} onChange={e=>setKey(e.target.value)}>{matches.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select>}</>}
      </div>}
      <div className={`card-hand ${hand.length>16?'many-cards':''} ${hand.length>28?'bury-hand':''}`} aria-label="你的手牌" onPointerMove={pointerMove} onPointerUp={()=>{if(drag.current?.moved)swiped.current=true;drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
        {hand.map(card=><button key={card} data-card={card} className={`hand-card ${selected.includes(card)?'selected-card':''} ${suggestions&&canSuggest&&hinted.includes(card)?'hint-card':''} ${state.kind==='tractor'&&category(card,state.trump,state.levelRank)===4?'trump-card':''}`} aria-label={cardLabel(card).replace(' 配牌','')} aria-pressed={selected.includes(card)} disabled={!humanTurn||state.phase==='bidding'} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);swiped.current=false;drag.current={card,x:e.clientX,y:e.clientY,select:!selected.includes(card),moved:false}}} onClick={()=>{if(swiped.current){swiped.current=false;return}drag.current=null;select(card)}}><PlayingCard card={card} wild={false}/></button>)}
        {rank>0&&<span className="empty-hand">{rank} 游 · 等待结算</span>}
      </div><div className="four-status" role="status">{notice|| (error?<button onClick={()=>setRetry(r=>r+1)}>{error} ↻</button>:tip)}</div>
      <div className="toolbar four-toolbar"><IconButton icon="book" label="规则" onClick={()=>setModal('rules')}/>{undoLimit(session.level)>0&&<IconButton icon="undo" label={`悔牌（剩余 ${remaining} 次）`} count={remaining} disabled={!remaining||ended||!session.actions.some(a=>a.seat===0)} onClick={()=>setSession(s=>undoCardsSession(s))}/>}{canSuggest&&<IconButton icon="bulb" label={suggestions?'关闭建议':'开启建议'} active={suggestions} onClick={()=>setSuggestions(!suggestions)}/>}<div className="menu-anchor"><IconButton icon="more" label="更多" active={menu} onClick={()=>setMenu(!menu)}/>{menu&&<div className="settings-menu">{canSuggest&&<Toggle label="出牌建议" value={suggestions} onChange={()=>setSuggestions(!suggestions)}/>}<button className="menu-item" onClick={()=>{setModal('restart');setMenu(false)}}>重新开局</button></div>}</div></div>
    </section>}
    </div>{saveError&&<p className="storage-notice">当前环境无法保存对局。</p>}
    {modal==='rules'&&<Modal title={addedCardNames[kind]} onClose={()=>setModal(null)}><div className="rules-content">{kind==='doudizhu'?<><p>三人一副牌，每人 17 张，留下 3 张底牌。轮流叫 1–3 分或不叫，最高者当地主；叫 3 分立即定地主，三家不叫则首家为 1 分地主。地主拿底牌并先出，另两人为农民一队。</p><p>支持单张、对子、三张、三带一／二、顺子、连对、飞机带单／带对、四带二／两对、四张炸弹、双王火箭。顺子和连续牌型不能带 2 或王。飞机单翅可含对子，四带二也可带一个对子。相同牌型、张数才可比较，火箭最大。</p><p>任何一家出完即该队获胜；炸弹和火箭翻倍，春天再翻倍。积分仅用于本地练习。</p></>:kind==='shuangkou'?<><p>四人两副牌，每人 27 张，对家一队。普通双扣，无百搭，不使用三带牌或连环炸。</p><p>支持单张、对子、三张、五张以上顺子、三对以上连对、三组以上连三张、四张以上同点炸弹、四王炸。连续牌型不能带 2 或王。炸弹先比张数再比点数，四王最大。</p><p>同队一、二名为双扣，一、三名为单扣，一、四名为平扣；练习分分别 ±2、±1、0。出完后的领出权由同伴接风。</p></>:<><p>双副升级，每人 25 张、底牌 8 张，固定打 2 的单副练习。发完后轮流用级牌亮主：单级牌、同花双级牌、双小王、双大王依次更强。最终亮主者坐庄；无人亮主则你坐庄、打无主。</p><p>庄家收底并扣下 8 张。对家一队，5、10、K 是分牌。庄方守 80 分，闲方抓到 80 分即胜。首引可出单张、对子或拖拉机，首版不开放混合甩牌。</p><p>有首引花色必须先跟，主牌算一门。同长度拖拉机能跟则必须跟，否则尽量跟对子；不足该门张数时全部跟出再垫牌。缺门时用同牌型的主牌可以将吃，最大者取分并领出。</p><p>闲方拿末圈可抠底：单张乘 2、对子乘 4，n 对拖拉机乘 2ⁿ⁺¹。结算显示本副升几级，下一次练习仍从打 2 开始。</p></>}<p>0 档可连续回退两次自己的决策，1 档一次；合法新决策恢复回退深度。回退同时撤销之后的 AI 行动。1、2 档可开启建议。</p><p className="engine-note">本地 AI 只接收自己的手牌与公开信息，不读取其它手牌或未公开底牌。难度尚未标定为竞技水平。</p></div></Modal>}
    {modal==='restart'&&<Modal title="重新开局？" onClose={()=>setModal(null)}><div className="modal-actions"><button onClick={()=>setModal(null)}>继续本局</button><button className="primary-button" onClick={()=>{setPlaying(false);setLevel(session.level);setModal(null)}}>重新开局</button></div></Modal>}
  </div></main>
}
