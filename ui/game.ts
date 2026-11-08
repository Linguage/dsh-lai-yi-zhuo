export type Color = 1 | 2
export type Cell = 0 | Color
export type Kind = 'gomoku' | 'go'
export type Phase = 'playing' | 'scoring' | 'finished'
export type Level = 0 | 1 | 2 | 3 | 4
export type Move = { point: number | null; color: Color }
export type Position = {
  kind: Kind; size: number; board: Cell[]; turn: Color; phase: Phase
  moves: Move[]; hashes: string[]; passes: number; captures: [number, number]
  winner: Color | 0 | null; winningLine: number[]; reason: string; komi: number
}
export const other = (c: Color): Color => c === 1 ? 2 : 1
export const hash = (board: Cell[]) => board.join('')
export const colorName = (c: Color) => c === 1 ? '黑棋' : '白棋'
export function createGame(kind: Kind, size = kind === 'go' ? 9 : 15): Position {
  if ((kind === 'gomoku' && size !== 15) || (kind === 'go' && ![9,19].includes(size))) throw Error('不支持的棋盘尺寸')
  const board: Cell[] = Array(size*size).fill(0)
  return {kind,size,board,turn:1,phase:'playing',moves:[],hashes:[hash(board)],passes:0,captures:[0,0],winner:null,winningLine:[],reason:'',komi:kind==='go'?7.5:0}
}
export function neighbors(p: number, size: number): number[] {
  const x=p%size,y=Math.floor(p/size), out:number[]=[]
  if(x>0) out.push(p-1); if(x<size-1) out.push(p+1)
  if(y>0) out.push(p-size); if(y<size-1) out.push(p+size)
  return out
}
export function groupAt(board: Cell[], p: number, size: number) {
  const stones = new Set<number>(), liberties = new Set<number>()
  if (!board[p]) return {stones,liberties}
  const stack=[p];stones.add(p)
  while(stack.length) for(const n of neighbors(stack.pop()!,size)) {
    if(board[n]===0) liberties.add(n)
    else if(board[n]===board[p] && !stones.has(n)) {stones.add(n);stack.push(n)}
  }
  return {stones,liberties}
}
export function lineAt(board: Cell[], p: number, size: number): number[] {
  if(!board[p]) return []
  const x=p%size,y=Math.floor(p/size)
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]) {
    const line=[p]
    for(const sign of [-1,1]) for(let k=1;k<size;k++) {
      const nx=x+dx*k*sign,ny=y+dy*k*sign
      if(nx<0||ny<0||nx>=size||ny>=size||board[ny*size+nx]!==board[p]) break
      line.push(ny*size+nx)
    }
    if(line.length>=5) return line
  }
  return []
}
export type Placement = { board: Cell[]; captured: number[]; error?: undefined } | { error: string; board?: undefined; captured?: undefined }
export function placeGo(board: Cell[], size: number, p: number, color: Color, previous: readonly string[] | Set<string> = []): Placement {
  if(!Number.isInteger(p)||p<0||p>=board.length) return {error:'请落在棋盘交叉点上'}
  if(board[p]) return {error:'这里已经有棋子了'}
  const next=board.slice(), captured:number[]=[];next[p]=color
  const visited=new Set<number>()
  for(const n of neighbors(p,size)) if(next[n]===other(color)&&!visited.has(n)) {
    const group=groupAt(next,n,size);group.stones.forEach(s=>visited.add(s))
    if(group.liberties.size===0) for(const s of group.stones) {next[s]=0;captured.push(s)}
  }
  if(groupAt(next,p,size).liberties.size===0) return {error:'这里没有气，不能落子'}
  const h=hash(next)
  if(previous instanceof Set ? previous.has(h) : previous.includes(h)) return {error:'这一步会重复之前的局面，请先下别处'}
  return {board:next,captured}
}
export function play(state: Position, point: number | null): {state: Position; error?: string} {
  if(state.phase!=='playing') return {state,error:'本局已经进入结算'}
  if(point===null) {
    if(state.kind!=='go') return {state,error:'五子棋不能停一手'}
    const passes=state.passes+1
    return {state:{...state,turn:other(state.turn),passes,phase:passes>=2?'scoring':'playing',moves:[...state.moves,{point:null,color:state.turn}],reason:passes>=2?'双方停一手，请确认死子':'停一手'}}
  }
  if(!Number.isInteger(point)||point<0||point>=state.board.length) return {state,error:'请落在棋盘交叉点上'}
  if(state.board[point]) return {state,error:'这里已经有棋子了'}
  let board=state.board.slice(),captures:[number,number]=[...state.captures],reason=''
  if(state.kind==='go') {
    const result=placeGo(state.board,state.size,point,state.turn,state.hashes)
    if(result.error!==undefined) return {state,error:result.error}
    board=result.board;captures[state.turn-1]+=result.captured.length
    reason=result.captured.length?`提掉 ${result.captured.length} 子`:''
  } else board[point]=state.turn
  const winningLine=state.kind==='gomoku'?lineAt(board,point,state.size):[]
  const full=state.kind==='gomoku'&&board.every(Boolean)
  return {state:{...state,board,captures,turn:other(state.turn),passes:0,moves:[...state.moves,{point,color:state.turn}],hashes:[...state.hashes,hash(board)],
    phase:winningLine.length||full?'finished':'playing',winner:winningLine.length?state.turn:full?0:null,winningLine,
    reason:winningLine.length?'五子连珠':full?'满盘和棋':reason}}
}
export type Score = {black:number;white:number;komi:number;margin:number;winner:Color|0;ownership:Cell[];board:Cell[]}
export function areaScore(state: Pick<Position,'board'|'size'|'komi'>, dead: readonly number[] = []): Score {
  const board=state.board.slice(),visited=new Set<number>();dead.forEach(p=>{board[p]=0})
  const ownership=board.slice();let black=board.filter(v=>v===1).length,white=board.filter(v=>v===2).length
  for(let p=0;p<board.length;p++) if(!board[p]&&!visited.has(p)) {
    const region=[p],borders=new Set<Color>();visited.add(p)
    for(let i=0;i<region.length;i++) for(const n of neighbors(region[i],state.size)) {
      if(board[n]) borders.add(board[n] as Color)
      else if(!visited.has(n)) {visited.add(n);region.push(n)}
    }
    if(borders.size===1) {
      const owner=[...borders][0];region.forEach(n=>ownership[n]=owner)
      if(owner===1) black+=region.length;else white+=region.length
    }
  }
  const margin=black-white-state.komi
  return {black,white,komi:state.komi,margin,winner:margin>0?1:margin<0?2:0,ownership,board}
}
export function finishScore(state: Position, dead: number[]): Position {
  const score=areaScore(state,dead)
  return {...state,phase:'finished',winner:score.winner,reason:`${colorName(score.winner||1)}胜 ${Math.abs(score.margin)} 点`}
}
export function resign(state: Position, color: Color): Position {
  return {...state,phase:'finished',winner:other(color),reason:`${colorName(color)}认输`}
}
export function ruleTip(state: Position): string {
  if(state.phase==='scoring') return '点棋子标记死子，确认后数子'
  if(state.kind==='gomoku') return state.moves.length===0?'落在交叉点，先连成五颗即胜':'横、竖、斜，连成五颗即胜'
  if(state.reason.startsWith('提掉')) return `${state.reason} · 没有气的棋子会被提走`
  if(state.passes) return '双方连续停一手，就进入数子'
  if(!state.moves.length) return '黑棋先行，相邻空点是棋子的「气」'
  const last=state.moves.at(-1)!.point
  if(last!==null&&state.board[last]) {
    const count=groupAt(state.board,last,state.size).liberties.size
    return count===1?'这组棋只剩一口气':`刚落的这组棋有 ${count} 口气`
  }
  return '围住空地，保护自己的棋子'
}
export const coordinate = (point:number,size:number) => `${'ABCDEFGHJKLMNOPQRST'[point%size]}${size-Math.floor(point/size)}`
