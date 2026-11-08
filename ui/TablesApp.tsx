import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { App as ChessApp, IconButton, Modal, Toggle } from './App.tsx'
import { Icon } from './icons.tsx'
import { PlayingCard, MahjongTile, FourSeat, seatNames } from './TablePieces.tsx'
import { beats, cardLabel, cardProgress, classify, observeCards } from './guandan.ts'
import type { SeatId } from './guandan.ts'
import { revealedMahjongHand, claimsFor, mahjongCanHu, legalDiscards, kongOptions, observeMahjong, tileName, tileType, mahjongNames, isSichuan } from './mahjong.ts'
import type { MahjongAction, MahjongVariant } from './mahjong.ts'
import { encodeTable, newTable, restoreTable, tableAct, tableKey, undoTable } from './table-session.ts'
import type { TableAction, TableKind, TableSession } from './table-session.ts'
import { RoyalGame } from './RoyalGame.tsx'
import { AddedCardGame } from './AddedCardGame.tsx'
import { undoLimit } from './storage.ts'
import type { Level } from './game.ts'

const levelNames = ['启蒙', '入门', '练习', '进阶', '挑战']
function read(key: string) { try { return localStorage.getItem(key) } catch { return null } }
const tableNames = { guandan: '掼蛋', mahjong: '麻将' }
type Group = 'lobby' | 'chess' | 'cards' | 'mahjong-menu' | 'xiangqi' | 'international' | 'doudizhu' | 'shuangkou' | 'tractor' | 'sichuan' | 'bloodflow' | 'guangdong' | TableKind
const groups: Group[] = ['lobby','chess','cards','mahjong-menu','xiangqi','international','doudizhu','shuangkou','tractor','sichuan','bloodflow','guangdong','guandan','mahjong']

function MiniTable({ kind }: { kind: 'chess' | TableKind }) {
  return <div className={`mini-table mini-${kind}`} aria-hidden="true">{kind === 'chess' ? <div className="mini-grid">{[[36,38,1],[46,48,2],[56,58,1],[36,58,2],[56,38,1]].map(([x,y,c],i)=><i key={i} className={`stone stone-${c}`} style={{left:`${x}%`,top:`${y}%`}}/>)}</div>
    : kind === 'guandan' ? <div className="mini-cards">{[10,24,38].map((c,i)=><span key={c} style={{transform:`translateX(${(i-1)*28}px) rotate(${(i-1)*12}deg)`}}><PlayingCard card={c}/></span>)}</div>
      : <div className="mini-tiles">{[0,44,84,124].map(t=><MahjongTile key={t} tile={t}/>)}</div>}</div>
}

export function TablesApp() {
  const [group, setGroup] = useState<Group>(() => {
    try { const g = sessionStorage.getItem('dsh-table-group'); return groups.includes(g as Group) ? g as Group : 'lobby' } catch { return 'lobby' }
  })
  function open(g: Group) { setGroup(g); try { sessionStorage.setItem('dsh-table-group', g) } catch { /* navigation still works */ } }
  if (group === 'chess') return <ChessApp onExit={() => open('lobby')} onRoyal={kind=>open(kind==='chess'?'international':'xiangqi')}/>
  if (group === 'xiangqi' || group === 'international') return <RoyalGame key={group} kind={group==='xiangqi'?'xiangqi':'chess'} onExit={()=>open('chess')}/>
  if (group === 'doudizhu' || group === 'shuangkou' || group === 'tractor') return <AddedCardGame key={group} kind={group} onExit={()=>open('cards')}/>
  if (group === 'guandan') return <FourPlayerTable kind="guandan" onExit={()=>open('cards')}/>
  if (group === 'mahjong' || group === 'sichuan' || group === 'bloodflow' || group === 'guangdong') return <FourPlayerTable key={group} kind="mahjong" variant={group==='mahjong'?'basic':group} onExit={()=>open('mahjong-menu')}/>
  if (group==='cards'||group==='mahjong-menu') {
    const cards=group==='cards'
    const choices: [Group,string,string,string][] = cards ? [['guandan','掼蛋','同伴 · 打 2','♥'],['doudizhu','斗地主','三人 · 叫分','♠'],['tractor','升级','双升 · 抓分','♦'],['shuangkou','双扣','四人 · 无百搭','♣']] : [['mahjong','基础麻将','吃碰杠胡','東'],['sichuan','血战到底','川麻 · 胡后离场','萬'],['bloodflow','血流成河','川麻 · 胡后继续','發'],['guangdong','广东推倒胡','无鬼 · 不买马','中']]
    return <main className="app game-menu-screen"><div className="table-frame"><header className="game-header"><div className="heading-group"><IconButton icon="back" label="返回选桌" onClick={()=>open('lobby')}/><h1>{cards?'牌桌':'麻将桌'}</h1></div></header><div className={`variant-choices ${cards?'card-choices':'tile-choices'}`}>{choices.map(([id,title,caption,symbol])=><button className="variant-choice" key={id} onClick={()=>open(id)} aria-label={`选择${title}`}><div className="variant-art" aria-hidden="true"><span>{symbol}</span></div><div className="variant-caption"><h2>{title}</h2><small>{caption}</small></div><Icon name="chevron"/></button>)}</div><div className="home-footer"><span className="small-dot"/>人机陪练<span className="footer-divider"/>本地保存</div></div></main>
  }
  return <main className="app lobby-screen"><div className="table-frame"><section className="lobby-content">
    <span className="lobby-symbol"><i/><i/><i/></span><h1>来一桌</h1>
    <div className="table-choices">{(['chess', 'guandan', 'mahjong'] as const).map(kind => <button className="table-choice" key={kind} onClick={() => open(kind==='guandan'?'cards':kind==='mahjong'?'mahjong-menu':'chess')} aria-label={`进入${kind === 'chess' ? '棋桌' : kind === 'guandan' ? '牌桌' : '麻将桌'}`}>
      <MiniTable kind={kind}/><div className="choice-caption"><h2>{kind === 'chess' ? '棋桌' : kind === 'guandan' ? '牌桌' : '麻将桌'}</h2><Icon name="chevron"/></div>
      <small>{kind === 'chess' ? '五子棋 · 围棋 · 象棋 · 国际象棋' : kind === 'guandan' ? '掼蛋 · 斗地主 · 升级 · 双扣' : '基础 · 川麻 · 广东' }</small>
    </button>)}</div><div className="home-footer"><span className="small-dot"/>人机陪练<span className="footer-divider"/>本地保存</div>
  </section></div></main>
}

function FourPlayerTable({ kind, onExit,variant='basic' }: { kind: TableKind; onExit: () => void;variant?:MahjongVariant }) {
  const [saved] = useState(() => restoreTable(read(tableKey(kind,variant)), kind,variant))
  const [session, setSession] = useState<TableSession>(() => saved || newTable(kind, 0,undefined,variant))
  const [playing, setPlaying] = useState(false), [level, setLevel] = useState<Level>(saved?.level ?? 0)
  const [selected, setSelected] = useState<number[]>([]), [shape, setShape] = useState('')
  const [menu, setMenu] = useState(false), [modal, setModal] = useState<'rules' | 'restart' | null>(null)
  const [notice, setNotice] = useState(''), [storageError, setStorageError] = useState(false), [engineError, setEngineError] = useState(''), [retry, setRetry] = useState(0)
  const [suggestions, setSuggestions] = useState(false), [reference, setReference] = useState(false)
  const [hint, setHint] = useState<{ action: TableAction; label?: string; distance?: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null), gesture = useRef<{ id: number; x: number; y: number; moved: boolean; select: boolean } | null>(null)
  const swiped = useRef(false)
  const state = session.state, isHuman = state.turn === 0, ended = state.phase === 'finished'
  const canSuggest = session.level === 1 || session.level === 2
  const options = useMemo(() => state.kind === 'guandan' ? classify(selected).filter(m => beats(m, state.last?.move ?? null)) : [], [selected, state])
  const selectedMove = options.find(m => m.key === shape) || options[0]
  const remaining = undoLimit(session.level) - session.undoStreak
  const claims = state.kind === 'mahjong' && state.phase === 'claims' && isHuman ? claimsFor(state, 0) : []
  const kongs = state.kind === 'mahjong' && isHuman ? kongOptions(state, 0) : []
  const canHu = state.kind === 'mahjong' && mahjongCanHu(state,0)

  useEffect(() => {
    try { const p = JSON.parse(read('dsh-four-preferences') || '{}'); setReference(p.reference === true); setSuggestions(p.suggestions === true) } catch { /* defaults */ }
  }, [])
  useEffect(() => { if (!playing) return; try { localStorage.setItem(tableKey(kind,variant), encodeTable(session)) } catch { setStorageError(true) } }, [session, playing, kind])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3300); return () => clearTimeout(timer) }, [notice])
  useEffect(() => {
    if (!menu) return
    const outside = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menu])
  useEffect(() => {
    setHint(null); setDistance(null); setEngineError(''); setSelected([]); setShape('')
    if (!playing || ended || isHuman && !(suggestions && canSuggest) && !reference) return
    const seat = state.turn, isAI = seat !== 0
    let cancelled = false, timer: ReturnType<typeof setTimeout>, worker: Worker | null = null
    const fail = () => { if (!cancelled) { setEngineError('计算中断，点击重试'); worker?.terminate() } }
    const watchdog = setTimeout(fail, 15000)
    try {
      worker = new Worker(new URL('./table.worker.ts', import.meta.url), { type: 'module' })
      worker.onerror = fail
      worker.onmessage = (event: MessageEvent<{ action?: TableAction; label?: string; distance?: number; error?: string }>) => {
        clearTimeout(watchdog)
        if (cancelled) return
        const result = event.data
        if (result.error || !result.action) { fail(); return }
        if (isAI) timer = setTimeout(() => {
          if (cancelled) return
          setSession(current => {
            if (current.state !== state) return current
            const next = tableAct(current, seat, result.action!)
            if (next.error) { setEngineError(next.error); return current }
            return next.session
          })
        }, 520)
        else { setHint({ action: result.action, label: result.label, distance: result.distance }); setDistance(result.distance ?? null) }
        worker?.terminate()
      }
      worker.postMessage(state.kind === 'guandan'
        ? { kind: state.kind, observation: observeCards(state, seat), level: isAI ? session.level : 3 }
        : { kind: state.kind, observation: observeMahjong(state, seat), level: isAI ? session.level : 3 })
    } catch { fail() }
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(watchdog); worker?.terminate() }
  }, [state, playing, session.level, suggestions, canSuggest, reference, retry, ended, isHuman])

  function preference(key: 'reference' | 'suggestions') {
    const values = { reference, suggestions, [key]: key === 'reference' ? !reference : !suggestions }
    setReference(values.reference); setSuggestions(values.suggestions)
    try { localStorage.setItem('dsh-four-preferences', JSON.stringify(values)) } catch { setStorageError(true) }
  }
  function act(action: TableAction) {
    if (!playing || !isHuman || ended) return
    const result = tableAct(session, 0, action)
    if (result.error) { setNotice(result.error); return }
    setNotice(''); setSelected([]); setSession(result.session)
  }
  function mj(action: MahjongAction) { act({ game: 'mahjong', action }) }
  function start(resume = false) {
    if (!resume) setSession(newTable(kind, level,undefined,variant))
    setPlaying(true); setMenu(false); setModal(null); setNotice('')
  }
  function choose(card: number) { if (!playing || !isHuman || ended) return; setSelected(current => current.includes(card) ? current.filter(c => c !== card) : [...current, card]) }
  function cardPointerDown(e: React.PointerEvent<HTMLButtonElement>, card: number) {
    if (!isHuman || !playing || ended) return
    swiped.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { id: card, x: e.clientX, y: e.clientY, moved: false, select: !selected.includes(card) }
  }
  function cardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || Math.hypot(e.clientX - g.x, e.clientY - g.y) < 8) return
    if (!g.moved) { g.moved = true; setSelected(current => g.select ? [...new Set([...current, g.id])] : current.filter(c => c !== g.id)) }
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>('[data-card]')
    if (target?.dataset.card) { const card = Number(target.dataset.card); setSelected(current => g.select ? [...new Set([...current, card])] : current.filter(c => c !== card)) }
  }
  const progress = state.kind === 'guandan' ? cardProgress(state) : null
  const suggestedCards = suggestions && canSuggest && hint?.action.game === 'guandan' ? hint.action.cards || [] : []
  const suggestedTile = suggestions && canSuggest && hint?.action.game === 'mahjong' && hint.action.action.kind === 'discard' ? hint.action.action.tile : null
  const rank = state.kind === 'guandan' ? state.order.indexOf(0) + 1 : 0
  const humanAction = playing && !ended && isHuman
  const hintText = hint?.action.game === 'guandan' ? hint.label : hint?.action.game === 'mahjong' ? hint.action.action.kind === 'discard' ? `建议打${tileName(hint.action.action.tile)}` : ({ hu: '可以和牌', pass: '建议过', chi: '可以吃', peng: '可以碰', gang: '可以杠', concealed: '可以暗杠', add: '可以补杠', exchange:'选择高亮的三张牌交换',missing:hint?.action.game==='mahjong'&&hint.action.action.kind==='missing'?`建议缺${['万','筒','条'][hint.action.action.suit]}`:'请选择较少的一门定缺' }[hint.action.action.kind]) : ''

  return <main className={`app four-screen ${kind}-screen ${playing ? 'four-playing' : 'four-setup'}`}><div className="table-frame">
    <header className="game-header"><div className="heading-group"><IconButton icon="back" label="返回选桌" onClick={onExit}/><h1>{kind==='mahjong'&&variant!=='basic'?mahjongNames[variant]:tableNames[kind]}</h1><span className="level-badge">{playing ? session.level : level} 档</span></div><span className="table-mode">{kind === 'guandan' ? '单局 · 打 2' : variant==='guangdong'?'无鬼 · 不买马':isSichuan(variant)?'换三张 · 定缺':'基础麻将'}</span></header>
    <div className="four-layout">
      <div className="table-stage"><div className={`four-square felt-${kind}`} data-testid="square-table">
        <div className="felt-inlay"/>
        {([1,2,3] as SeatId[]).map(seat => <div key={seat} className={`opponent-hand opponent-${seat}`} aria-hidden="true">{state.kind==='mahjong'&&state.wins.some(w=>w.seat===seat)?revealedMahjongHand(state,seat).map(t=><MahjongTile key={t} tile={t} tiny/>):Array.from({ length: Math.min(kind === 'guandan' ? 5 : 8, state.hands[seat].length) }, (_, i) => kind === 'guandan' ? <PlayingCard key={i} back small/> : <MahjongTile key={i} back tiny/>)}</div>)}
        {state.kind === 'guandan' ? <>
          <div className="table-center"><span className="felt-emblem">♣</span>{reference && playing && <small className="public-reference" title="双方已出的牌数，不是胜率">{progress![0]} / 54 <i>·</i> {progress![1]} / 54</small>}{!state.last && playing && <span className="lead-label">{state.message || '领出'}</span>}</div>
          {state.plays.map((move, seat) => move && <div key={seat} className={`table-play play-${seat} ${state.last?.seat === seat ? 'last-play' : ''}`}>
            {move === 'pass' ? <span className="pass-label">不出</span> : <><div className="played-cards">{move.cards.map(card => <PlayingCard key={card} card={card} small/>)}</div><small>{move.label}</small></>}
          </div>)}
        </> : <>
          <div className="table-center mahjong-center"><b>東</b><small>余 {state.wall.length}</small>{reference && playing && isHuman && distance !== null && <small className="public-reference">{distance < 0 ? '牌型成和' : distance === 0 ? '牌型听牌' : `${distance} 向听（牌型）`}</small>}</div>
          {state.rivers.map((river, seat) => <div key={seat} className={`river river-${seat}`} aria-label={`${seatNames[seat]}的牌河`}>{river.map(tile => <span className={state.last?.tile === tile ? 'last-discard' : ''} key={tile}><MahjongTile tile={tile} tiny/></span>)}</div>)}
          {variant!=='basic'&&<div className="regional-scoreboard">{state.scores.map((score,seat)=><span key={seat} title={`${seatNames[seat]}：${score} 分`}>{seatNames[seat]} {score>0?'+':''}{score}{state.missing[seat]!==null&&<i>缺{['万','筒','条'][state.missing[seat]!]}</i>}{state.wins.some(w=>w.seat===seat)&&<b>胡{state.wins.filter(w=>w.seat===seat).length}</b>}</span>)}</div>}
          {state.melds.map((melds, seat) => seat !== 0 && <div className={`table-melds melds-${seat}`} key={seat}>{melds.map((m, i) => <span className="meld" key={i}>{m.tiles.map(tile => <MahjongTile key={tile} tile={tile} back={m.kind === 'concealed'} tiny/>)}</span>)}</div>)}
        </>}
        {([0,1,2,3] as SeatId[]).map(seat => <FourSeat key={seat} seat={seat} active={playing && !ended && state.turn === seat} team={kind === 'guandan'} count={state.hands[seat].length} finished={state.kind === 'guandan' ? state.order.indexOf(seat) + 1 : undefined}/>)}
      </div></div>

      {!playing ? <section className="four-setup-panel">
        <h2>{kind === 'guandan' ? '同伴坐在对面' : '四人，慢慢来'}</h2>
        <p>{kind === 'guandan' ? '你与对家一队 · 三位 AI 陪练' : variant==='guangdong'?'只自摸、抢杠胡 · 不吃牌':variant==='sichuan'?'108 张 · 胡牌后离场':variant==='bloodflow'?'108 张 · 胡后锁手继续':'无花牌 · 无番数门槛'}</p>
        <div className="difficulty" aria-label="难度">{([0,1,2,3,4] as Level[]).map(n => <button key={n} aria-label={`${n} 档 ${levelNames[n]}`} aria-pressed={level === n} onClick={() => setLevel(n)}><b>{n}</b><span>{levelNames[n]}</span></button>)}</div>
        <p className="setup-note">{level === 0 ? '规则提示 · 可连续回退两步' : level === 1 ? '可开建议 · 可回退一步' : level === 2 ? '可开建议' : '专心对局'}</p>
        <button className="primary-button" onClick={() => start()}>开始练习 <Icon name="chevron"/></button>
        {(saved || session.actions.length > 0) && session.state.phase !== 'finished' && <button className="resume-button" onClick={() => start(true)}><Icon name="refresh"/>继续上次的{kind==='mahjong'&&variant!=='basic'?mahjongNames[variant]:tableNames[kind]}</button>}
        <button className="text-rule" onClick={() => setModal('rules')}>规则 <Icon name="book"/></button>
      </section> : <section className="player-dock">
        {ended ? <div className="four-result" role="status"><span>本局结束</span><h2>{state.kind === 'guandan' ? state.winner === 0 ? '你们赢了' : '对方获胜' : variant!=='basic' ? '本局结算' : state.winner === null ? '流局' : state.winner === 0 ? '你和牌了' : `${seatNames[state.winner]}和牌`}</h2><p>{state.reason}{state.kind === 'guandan' && ` · ${state.order.map(s => seatNames[s]).join(' → ')}`}</p>
          {state.kind === 'mahjong' && variant==='basic' && state.winner !== null && <div className="winning-hand">{[...state.hands[state.winner], ...(state.pending ? [state.pending.tile] : [])].map(tile => <MahjongTile key={tile} tile={tile} tiny/>)}</div>}
          {state.kind==='mahjong'&&variant!=='basic'&&<div className="score-chips">{state.scores.map((score,seat)=><span key={seat}>{seatNames[seat]} {score>0?'+':''}{score}</span>)}</div>}
          <button className="primary-button" onClick={() => { setLevel(session.level); setPlaying(false) }}>再来一局 <Icon name="refresh"/></button>
        </div> : <div className="table-actions" aria-label="当前可用操作">
          {state.kind === 'guandan' ? <><button className="quiet-action" disabled={!humanAction || !state.last} onClick={() => act({ game: 'guandan', cards: null })}>不出</button><button className="primary-button" disabled={!humanAction || !selectedMove} onClick={() => act({ game: 'guandan', cards: selected, shapeKey: selectedMove?.key })}>出牌</button>
            {options.length > 1 && <select className="shape-select" aria-label="选择牌型" value={selectedMove?.key} onChange={e => setShape(e.target.value)}>{options.map(m => <option value={m.key} key={m.key}>{m.label}</option>)}</select>}
          </> : <>
            {state.kind==='mahjong'&&humanAction&&state.phase==='exchange'&&<button className="primary-button" disabled={selected.length!==3||new Set(selected.map(t=>Math.floor(tileType(t)/9))).size!==1} onClick={()=>mj({kind:'exchange',tiles:selected})}>换三张 {selected.length}/3</button>}
            {state.kind==='mahjong'&&humanAction&&state.phase==='missing'&&[0,1,2].map(suit=><button className="claim-button" key={suit} onClick={()=>mj({kind:'missing',suit})}>缺{['万','筒','条'][suit]}</button>)}
            {canHu && <button className="primary-button" onClick={() => mj({ kind: 'hu', tiles: [] })}>胡</button>}
            {kongs.map((a, i) => <button className="claim-button" key={i} onClick={() => mj(a)}>{a.kind === 'concealed' ? '暗杠' : '补杠'}{'tile' in a ? tileName(a.tile) : ''}</button>)}
            {claims.map((c, i) => <button key={i} className={c.kind === 'hu' ? 'primary-button' : 'claim-button'} onClick={() => mj(c)}>{({ hu:'胡', chi:'吃', peng:'碰', gang:'杠', pass:'过' })[c.kind]}{c.kind === 'chi' && <span className="claim-tiles">{c.tiles.map(tile => <MahjongTile key={tile} tile={tile} tiny/>)}</span>}</button>)}
            {humanAction && state.phase === 'claims' && <button className="quiet-action" onClick={() => mj({ kind: 'pass', tiles: [] })}>过</button>}
            {humanAction && state.phase === 'discard' && !canHu && !kongs.length && <span className="turn-caption">轮到你</span>}
          </>}
        </div>}

        {state.kind === 'guandan' ? <div className={`card-hand ${state.hands[0].length > 16 ? 'many-cards' : ''}`} aria-label="你的手牌" onPointerMove={cardPointerMove} onPointerUp={() => { if (gesture.current?.moved) swiped.current = true; gesture.current = null }} onPointerCancel={() => { gesture.current = null; swiped.current = true }}>
          {state.hands[0].map(card => <button type="button" key={card} data-card={card} className={`hand-card ${selected.includes(card) ? 'selected-card' : ''} ${suggestedCards.includes(card) ? 'hint-card' : ''}`} aria-label={cardLabel(card)} aria-pressed={selected.includes(card)} disabled={!humanAction} onPointerDown={e => cardPointerDown(e, card)} onClick={() => { if (swiped.current) { swiped.current = false; return } gesture.current = null; choose(card) }}><PlayingCard card={card}/></button>)}
          {rank > 0 && <span className="empty-hand">{rank} 游 · 同伴还在继续</span>}
        </div> : <div className="mahjong-rack" aria-label="你的手牌">
          <div className="own-melds">{state.melds[0].map((m,i) => <span className="meld" key={i}>{m.tiles.map(tile => <MahjongTile tile={tile} key={tile} tiny/>)}</span>)}</div>
          <div className="mahjong-hand" style={{ '--tile-count': state.hands[0].length } as CSSProperties}>
            {state.hands[0].map(tile => <button key={tile} className={`hand-tile ${state.drawn === tile && isHuman ? 'drawn-tile' : ''} ${suggestedTile === tile || suggestions&&canSuggest&&hint?.action.game==='mahjong'&&hint.action.action.kind==='exchange'&&hint.action.action.tiles.includes(tile) ? 'hint-tile' : ''} ${state.phase==='exchange'&&selected.includes(tile)?'exchange-selected':''} ${state.missing[0]===Math.floor(tileType(tile)/9)?'missing-tile':''}`} aria-label={`${state.phase==='exchange'?'交换':'打出'}${tileName(tile)}`} aria-pressed={state.phase==='exchange'?selected.includes(tile):undefined} disabled={!humanAction || !(state.phase==='exchange'||state.phase==='discard'&&legalDiscards(state,0).includes(tile))} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { id: tile, x: e.clientX, y: e.clientY, moved: false, select: false }; swiped.current = false }} onPointerUp={e => { const g = gesture.current; if (state.phase==='discard' && g && g.id === tile && g.y - e.clientY > 24) { swiped.current = true; mj({ kind: 'discard', tile }) } gesture.current = null }} onPointerCancel={() => { gesture.current = null }} onClick={() => { if (swiped.current) { swiped.current = false; return } if(state.phase==='exchange'){setSelected(current=>current.includes(tile)?current.filter(t=>t!==tile):[...current,tile]);return}mj({ kind: 'discard', tile }) }}><MahjongTile tile={tile}/></button>)}
          </div>
        </div>}
        <div className="four-status" role="status" aria-live="polite">{notice || (engineError ? <button onClick={() => setRetry(r => r + 1)}>{engineError} ↻</button> : suggestions && canSuggest && isHuman && !ended ? hintText : session.level === 0 && !ended ? kind === 'guandan' ? isHuman ? state.kind === 'guandan' && state.last ? '同牌型压过上一手，也可以不出' : '点选或划选手牌，再点出牌' : '亮点表示当前回合' : isHuman ? state.phase==='exchange'?'选择三张同花色的牌，换给下家':state.phase==='missing'?'定缺后必须先打完这一门':state.phase === 'claims' ? '吃碰杠胡，或点「过」' : '点牌即出，也可向桌心划出' : '亮点表示当前回合' : '')}</div>
        <div className="toolbar four-toolbar"><IconButton icon="book" label="规则" onClick={() => setModal('rules')}/>
          {undoLimit(session.level) > 0 && <IconButton icon="undo" label={`悔牌（剩余 ${remaining} 次）`} count={remaining} disabled={ended || !remaining || !session.actions.some(a => a.seat === 0)} onClick={() => { setSession(current => undoTable(current)); setNotice(''); setSelected([]) }}/>}
          {canSuggest && <IconButton icon="bulb" label={suggestions ? '关闭建议' : '开启建议'} active={suggestions} disabled={ended} onClick={() => preference('suggestions')}/>}
          <div className="menu-anchor" ref={menuRef}><IconButton icon="more" label="更多" active={menu} onClick={() => setMenu(v => !v)}/>{menu && <div className="settings-menu"><Toggle label={kind === 'guandan' ? '出牌进度' : '向听数参考'} value={reference} onChange={() => preference('reference')}/><p className="estimate-note">{kind === 'guandan' ? '双方已出牌数，不是胜率' : '基础牌型参考，不含定缺及地方限制'}</p><button className="menu-item" onClick={() => { setModal('restart'); setMenu(false) }}><Icon name="refresh"/>重新开局</button></div>}</div>
        </div>
      </section>}
    </div>
    {storageError && <p className="storage-notice" role="status">当前环境无法保存，关闭页面后进度会丢失。</p>}
    {modal === 'rules' && <Modal title={kind === 'guandan' ? '掼蛋 · 单局练习' : mahjongNames[variant]} onClose={() => setModal(null)}><div className="rules-content">{kind === 'guandan' ? <>
      <p>四人两副牌，每人 27 张。你和对家一队，本局打 2，由你领出。大王、小王最大，其次是级牌 2，再按 A 到 3 排列。</p><p>支持单张、对子、三张、三带二、五张顺子、三连对、两组三张连牌（钢板）。A 可接在 2 前，也可接在 K 后。红桃 2 可替代非王的牌；选牌后如有多种解释，可在牌型菜单中选择。</p><p>同牌型比点数。四张起为炸弹：四王最大，其次六张及以上炸弹、同花顺、五张炸弹、四张炸弹。炸弹先比张数，再比点数。</p><p>无人接牌时由最后出牌者领出；他已出完则由同伴接风。按出完先后排游次，头游所在队获胜。首版练习一局，不含跨局升级、进贡与还贡。</p>
    </> : variant!=='basic'?<RegionalRules variant={variant}/>: <>
      <p>136 张牌，无花牌。你固定坐东并先打。每人 13 张，轮到时摸一张、打一张；点牌立即打出，也可向桌心划出。三位 AI 各自为战。</p><p>四组顺子或刻子加一对将即可和牌，也支持七对（七种不同对子）与十三幺；不设番数门槛，不计分番。</p><p>只能吃上家的牌；任一家可碰、明杠或和。暗杠与补杠后从牌尾补一张，补杠可被抢和。和优先于碰杠，碰杠优先于吃；多人同时和时按出牌后的顺序取最近一家。</p><p>不采用振听规则，也不允许抢暗杠。最后一张打出仍可和；牌墙耗尽后流局。首版固定东一局，不含连庄、花牌与地方番种。</p>
    </>}<div className="rules-divider"/><p>0 档可连续退回自己两次决策，1 档一次，2–4 档不可悔牌。每次回退会一并撤回之后的 AI 行动；你合法出牌或响应一次后重新计算。</p><p>1、2 档可开启建议，亮边标出推荐牌。对局自动保存在本机，可以离开后继续。</p><p className="engine-note">AI 使用自己的手牌与公开信息做本地计算。档位尚未标定为人类水平；牌桌显示出牌进度，麻将可显示向听数，暂不提供未经校准的胜率百分比。</p></div></Modal>}
    {modal === 'restart' && <Modal title="重新开局？" onClose={() => setModal(null)}><p>本局将被替换，重新选择难度后发牌。</p><div className="modal-actions"><button onClick={() => setModal(null)}>继续本局</button><button className="primary-button" onClick={() => { setPlaying(false); setLevel(session.level); setModal(null) }}>重新开局</button></div></Modal>}
  </div></main>
}

function RegionalRules({variant}:{variant:MahjongVariant}) {
  return <>{isSichuan(variant)?<><p>108 张万、筒、条，无字牌。先选三张同花色牌顺时针换给下家，再选择定缺的一门；有缺门牌时必须先打出，不可用缺门碰杠或胡牌。两门或一门牌才可胡；不能吃牌，支持碰、杠、一炮多响。</p><p>{variant==='sichuan'?'血战到底：胡牌后离场，不再摸打、收付后续杠分；三家胡牌或牌墙耗尽后结算。':'血流成河：胡牌后继续到牌墙耗尽。本版采用胡后锁手，不再吃碰杠、只能摸切，可多次胡牌。自摸后移走本次摸牌，保留原听牌结构。开局天胡不计。'}多人同时胡牌后由最后一家胡牌者的下家摸牌。放弃可胡的弃牌后，到自己下次摸牌才能再接炮。</p><p>明杠由放杠者付 2 分；暗杠由其他在局者各付 2 分，补杠各付 1 分。牌墙空时查花猪、查叫，未听牌者退回收取的杠分；已胡离场者不参与后续查叫。</p></>:<><p>广东推倒胡：136 张牌，无花、无鬼、不买马。不能吃；可碰、明杠、暗杠、补杠。只允许自摸或抢补杠胡，普通弃牌不能胡。第一家胡牌即结束。</p><p>明杠放杠者付 2 分，暗杠其他三家各付 2 分，补杠各付 1 分。抢杠由补杠者承担三家分数。牌墙空即流局，保留杠分。</p></>}<p>支持基本和型、七对（四张相同牌算两对）{variant==='guangdong'?'、十三幺':''}。练习计分：平胡 1，碰碰胡加 1 番，七对、清一色各加 2 番{isSichuan(variant)?'；每根、金钩钓各加 1 番':''}，最多 4 番、基础 16 分，自摸每家加 1 分。此为固定简化计分，不涵盖所有地方番种；所有积分仅限本机练习。</p><p>向听数仅供基础牌型参考，川麻定缺前后可能与实际可胡距离不同，请以合法胡牌按钮为准。</p></>
}
