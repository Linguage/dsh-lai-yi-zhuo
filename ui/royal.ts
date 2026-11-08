import { Chess, SQUARES } from 'chess.js'
import type { Square, PieceSymbol } from 'chess.js'
import type { Level } from './game.ts'
import { undoLimit } from './storage.ts'

export type RoyalKind = 'xiangqi' | 'chess'
export type Side = 'w' | 'b'
export type RoyalMove = { from: number; to: number; promotion?: string }
export type RoyalPosition = {
  kind: RoyalKind; board: (string | null)[]; turn: Side; moves: RoyalMove[]; checked: boolean
  phase: 'playing' | 'finished'; winner: Side | null; reason: string; quiet: number
  history: { key: string; by: Side | null; check: boolean }[]
}
export type RoyalSession = { kind: RoyalKind; human: Side; level: Level; moves: RoyalMove[]; undoStreak: number; resigned?: Side }
const enemy = (side: Side): Side => side === 'w' ? 'b' : 'w'
const sideOf = (piece: string | null) => piece ? piece === piece.toUpperCase() ? 'w' : 'b' : null
export const royalKey = (kind: RoyalKind) => `dsh-board-games-${kind}-v1`
export const royalNames = { xiangqi: '中国象棋', chess: '国际象棋' }
export const royalSideName = (kind: RoyalKind, side: Side) => side === 'b' ? '黑方' : kind === 'xiangqi' ? '红方' : '白方'
export const pieceName = (kind: RoyalKind, p: string) => kind === 'xiangqi' ? ({K:'帅',A:'仕',B:'相',N:'马',R:'车',C:'炮',P:'兵',k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'}[p] || p) : ({k:'王',q:'后',r:'车',b:'象',n:'马',p:'兵'}[p.toLowerCase()] || p)
export const chessGlyph: Record<string,string> = {K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
export const squareName = (kind: RoyalKind, point: number) => `${'abcdefghi'[point % (kind === 'chess' ? 8 : 9)]}${(kind === 'chess' ? 8 : 10) - Math.floor(point / (kind === 'chess' ? 8 : 9))}`

export function createXiangqi(): RoyalPosition {
  const rows = ['rnbakabnr','.........','.c.....c.','p.p.p.p.p','.........','.........','P.P.P.P.P','.C.....C.','.........','RNBAKABNR']
  const board = rows.join('').split('').map(p => p === '.' ? null : p)
  return {kind:'xiangqi',board,turn:'w',moves:[],checked:false,phase:'playing',winner:null,reason:'',quiet:0,history:[{key:board.map(p=>p||'.').join('')+'w',by:null,check:false}]}
}
function xqTargets(board: (string|null)[], from: number): number[] {
  const p=board[from];if(!p)return []
  const color=sideOf(p)!,x=from%9,y=Math.floor(from/9),kind=p.toLowerCase(),targets:number[]=[]
  const add=(nx:number,ny:number)=>{if(nx>=0&&nx<9&&ny>=0&&ny<10&&sideOf(board[ny*9+nx])!==color)targets.push(ny*9+nx)}
  const palace=(nx:number,ny:number)=>nx>=3&&nx<=5&&(color==='w'?ny>=7&&ny<=9:ny>=0&&ny<=2)
  if(kind==='r'||kind==='c')for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    let screen=false
    for(let n=1;n<10;n++){
      const nx=x+dx*n,ny=y+dy*n;if(nx<0||nx>=9||ny<0||ny>=10)break
      const t=ny*9+nx,occupant=board[t]
      if(kind==='r'){add(nx,ny);if(occupant)break}
      else if(!screen){if(occupant)screen=true;else add(nx,ny)}
      else if(occupant){add(nx,ny);break}
    }
  }
  if(kind==='n')for(const [dx,dy] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2]]){
    const leg=(y+(Math.abs(dy)===2?dy/2:0))*9+x+(Math.abs(dx)===2?dx/2:0)
    if(!board[leg])add(x+dx,y+dy)
  }
  if(kind==='b')for(const dx of [-2,2])for(const dy of [-2,2]){
    const ny=y+dy;if((color==='w'?ny>=5:ny<=4)&&!board[(y+dy/2)*9+x+dx/2])add(x+dx,ny)
  }
  if(kind==='a')for(const dx of [-1,1])for(const dy of [-1,1])if(palace(x+dx,y+dy))add(x+dx,y+dy)
  if(kind==='k'){
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(palace(x+dx,y+dy))add(x+dx,y+dy)
    for(const dy of [-1,1])for(let ny=y+dy;ny>=0&&ny<10;ny+=dy){const t=ny*9+x;if(board[t]){if(board[t]!.toLowerCase()==='k'&&sideOf(board[t])!==color)targets.push(t);break}}
  }
  if(kind==='p'){
    add(x,y+(color==='w'?-1:1));if(color==='w'?y<=4:y>=5){add(x-1,y);add(x+1,y)}
  }
  return targets
}
export function xqCheck(board:(string|null)[],side:Side):boolean {
  const king=board.indexOf(side==='w'?'K':'k');if(king<0)return true
  return board.some((p,i)=>sideOf(p)===enemy(side)&&xqTargets(board,i).includes(king))
}
function xqBoard(board:(string|null)[],move:RoyalMove){const next=board.slice();next[move.to]=next[move.from];next[move.from]=null;return next}
export function xqLegal(position: Pick<RoyalPosition,'board'|'turn'>):RoyalMove[]{
  return position.board.flatMap((p,from)=>sideOf(p)===position.turn?xqTargets(position.board,from).filter(to=>position.board[to]?.toLowerCase()!=='k'&&!xqCheck(xqBoard(position.board,{from,to}),position.turn)).map(to=>({from,to})):[])
}
export function playXiangqi(state:RoyalPosition,move:RoyalMove):RoyalPosition|null {
  if(state.phase==='finished'||!xqLegal(state).some(m=>m.from===move.from&&m.to===move.to))return null
  const captured=state.board[move.to],board=xqBoard(state.board,move),turn=enemy(state.turn),checked=xqCheck(board,turn)
  const key=board.map(p=>p||'.').join('')+turn,history=[...state.history,{key,by:state.turn,check:checked}]
  const next:RoyalPosition={...state,board,turn,checked,moves:[...state.moves,move],quiet:captured?0:state.quiet+1,history}
  if(!xqLegal(next).length){next.phase='finished';next.winner=state.turn;next.reason=checked?'将死':'困毙'}
  else if(history.filter(h=>h.key===key).length>=3){
    const first=history.findIndex(h=>h.key===key),cycle=history.slice(first+1)
    const perpetual=(side:Side)=>cycle.some(h=>h.by===side)&&cycle.filter(h=>h.by===side).every(h=>h.check)
    const red=perpetual('w'),black=perpetual('b');next.phase='finished';next.winner=red!==black?(red?'b':'w'):null;next.reason=red!==black?'长将判负':'三次重复和棋'
  }else if(next.quiet>=120){next.phase='finished';next.reason='60 回合无吃子和棋'}
  return next
}
function chessFor(moves:RoyalMove[],initial?:string){const c=new Chess(initial);for(const m of moves)c.move({from:SQUARES[m.from],to:SQUARES[m.to],promotion:m.promotion});return c}
export function chessPosition(c:Chess,moves:RoyalMove[]=[]):RoyalPosition {
  const checked=c.isCheck(),ended=c.isGameOver()
  const reason=c.isCheckmate()?'将死':c.isStalemate()?'逼和':c.isInsufficientMaterial()?'子力不足和棋':c.isThreefoldRepetition()?'三次重复和棋':c.isDrawByFiftyMoves()?'50 回合规则和棋':''
  return {kind:'chess',board:SQUARES.map(square=>{const p=c.get(square);return p?(p.color==='w'?p.type.toUpperCase():p.type):null}),turn:c.turn(),moves,checked,phase:ended?'finished':'playing',winner:c.isCheckmate()?enemy(c.turn()):null,reason,quiet:0,history:[]}
}
export function royalPosition(s:RoyalSession):RoyalPosition {
  let p:RoyalPosition
  if(s.kind==='chess')p=chessPosition(chessFor(s.moves),s.moves)
  else {p=createXiangqi();for(const m of s.moves){const n=playXiangqi(p,m);if(!n)throw Error('非法象棋记录');p=n}}
  return s.resigned?{...p,phase:'finished',winner:enemy(s.resigned),reason:`${royalSideName(s.kind,s.resigned)}认输`}:p
}
export function royalMoves(s:RoyalSession):RoyalMove[]{
  if(royalPosition(s).phase==='finished')return []
  return s.kind==='xiangqi'?xqLegal(royalPosition(s)):chessFor(s.moves).moves({verbose:true}).map(m=>({from:SQUARES.indexOf(m.from),to:SQUARES.indexOf(m.to),...(m.promotion?{promotion:m.promotion}:{})}))
}
export function actRoyal(s:RoyalSession,m:RoyalMove):RoyalSession|null {
  if(!royalMoves(s).some(x=>x.from===m.from&&x.to===m.to&&x.promotion===m.promotion))return null
  return {...s,moves:[...s.moves,m],undoStreak:royalPosition(s).turn===s.human?0:s.undoStreak}
}
export function undoRoyal(s:RoyalSession):RoyalSession {
  if(s.undoStreak>=undoLimit(s.level)||royalPosition(s).phase==='finished')return s
  let i=s.moves.length-1;while(i>=0&&(i%2===0?'w':'b')!==s.human)i--
  return i<0?s:{...s,moves:s.moves.slice(0,i),undoStreak:s.undoStreak+1}
}
export function restoreRoyal(raw:string|null,kind:RoyalKind):RoyalSession|null {
  try {const s=JSON.parse(raw||'null');if(!s||s.kind!==kind||!['w','b'].includes(s.human)||![0,1,2,3,4].includes(s.level)||!Array.isArray(s.moves)||s.moves.length>2000||s.resigned&&!['w','b'].includes(s.resigned))return null
    let position=createXiangqi();const chess=new Chess(),moves:RoyalMove[]=[]
    for(const m of s.moves){
      if(!m||!Number.isInteger(m.from)||!Number.isInteger(m.to)||m.from<0||m.to<0||m.from>=(kind==='chess'?64:90)||m.to>=(kind==='chess'?64:90))return null
      if(kind==='chess'){if(chess.isGameOver())return null;chess.move({from:SQUARES[m.from],to:SQUARES[m.to],promotion:m.promotion})}
      else {const next=playXiangqi(position,m);if(!next)return null;position=next}
      moves.push({from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})})
    }
    return {kind,human:s.human,level:s.level,moves,undoStreak:Number.isInteger(s.undoStreak)?Math.max(0,Math.min(undoLimit(s.level),s.undoStreak)):0,...(s.resigned?{resigned:s.resigned}:{})}
  }catch{return null}
}

const chessValues:Record<string,number>={p:100,n:320,b:335,r:500,q:900,k:20000},xqValues:Record<string,number>={p:100,n:360,b:180,a:180,r:900,c:400,k:20000}
export function royalEvaluation(board:(string|null)[],kind:RoyalKind):number {
  const width=kind==='chess'?8:9,height=kind==='chess'?8:10,values=kind==='chess'?chessValues:xqValues
  return board.reduce<number>((sum,p,i)=>{if(!p)return sum;const white=sideOf(p)==='w',y=Math.floor(i/width),advance=white?height-1-y:y,t=p.toLowerCase()
    const center=(width/2-Math.abs(i%width-(width-1)/2))*3
    return sum+(white?1:-1)*(values[t]+(t==='p'?advance*(kind==='chess'?9:12):t==='n'||t==='b'?center*3:center))
  },0)
}
export function analyzeRoyal(session:RoyalSession,level:Level,random=Math.random):{move:RoyalMove|null;whiteEstimate:number;depth:number} {
  const root=royalPosition(session),legal=royalMoves(session)
  if(!legal.length)return {move:null,whiteEstimate:root.winner==='w'?100:root.winner==='b'?0:50,depth:0}
  if(level===0)return {move:legal[Math.floor(random()*legal.length)],whiteEstimate:50,depth:0}
  const end=performance.now()+[0,90,300,650,1200][level],maxDepth=[0,1,2,3,4][level]
  let best=legal[0],bestScore=royalEvaluation(root.board,session.kind),finishedDepth=0,nodes=0
  const timed=()=>{if((++nodes&63)===0&&performance.now()>end)throw Error('budget')}
  const sign=root.turn==='w'?1:-1
  if(session.kind==='chess'){
    const c=chessFor(session.moves)
    const search=(depth:number,alpha:number,beta:number):number=>{
      timed();if(c.isCheckmate())return -100000-depth*100
      if(c.isDraw())return 0
      if(depth<=0)return royalEvaluation(chessPosition(c).board,'chess')*(c.turn()==='w'?1:-1)
      const moves=c.moves({verbose:true}).sort((a,b)=>(b.captured?chessValues[b.captured]:0)-(a.captured?chessValues[a.captured]:0))
      let value=-Infinity
      for(const m of moves){c.move(m);let score;try{score=-search(depth-1,-beta,-alpha)}finally{c.undo()}value=Math.max(value,score);alpha=Math.max(alpha,score);if(alpha>=beta)break}
      return value
    }
    for(let depth=1;depth<=maxDepth;depth++){
      let candidate=best,value=-Infinity
      try {for(const m of [best,...legal.filter(m=>m!==best)]){c.move({from:SQUARES[m.from],to:SQUARES[m.to],promotion:m.promotion as PieceSymbol});let score;try{score=-search(depth-1,-Infinity,-value)}finally{c.undo()}if(score>value){value=score;candidate=m}}}
      catch{break}
      best=candidate;bestScore=value*sign;finishedDepth=depth
    }
  }else{
    const search=(board:(string|null)[],turn:Side,depth:number,alpha:number,beta:number):number=>{
      timed();const moves=xqLegal({board,turn});if(!moves.length)return -100000-depth*100
      if(depth<=0)return royalEvaluation(board,'xiangqi')*(turn==='w'?1:-1)
      moves.sort((a,b)=>(board[b.to]?xqValues[board[b.to]!.toLowerCase()]:0)-(board[a.to]?xqValues[board[a.to]!.toLowerCase()]:0))
      let value=-Infinity
      for(const m of moves){const score=-search(xqBoard(board,m),enemy(turn),depth-1,-beta,-alpha);value=Math.max(value,score);alpha=Math.max(alpha,score);if(alpha>=beta)break}return value
    }
    for(let depth=1;depth<=maxDepth;depth++){
      let candidate=best,value=-Infinity
      try{for(const m of [best,...legal.filter(m=>m!==best)]){const next=playXiangqi(root,m)!,score=next.phase==='finished'?(next.winner===null?0:next.winner===root.turn?100000:-100000):-search(next.board,next.turn,depth-1,-Infinity,-value);if(score>value){value=score;candidate=m}}}catch{break}
      best=candidate;bestScore=value*sign;finishedDepth=depth
    }
  }
  return {move:best,whiteEstimate:Math.round(100/(1+Math.exp(-bestScore/650))),depth:finishedDepth}
}
