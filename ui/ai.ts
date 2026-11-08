import { other, neighbors, groupAt, lineAt, placeGo, areaScore, hash } from './game.ts'
import type { Cell, Color, Position, Level } from './game.ts'
export type Candidate = {point:number;score:number;reason:string}
export type Analysis = {move:number|null;suggestions:Candidate[];blackWinrate:number;nodes:number;elapsed:number}
const directions=[[1,0],[0,1],[1,1],[1,-1]]
export function gomokuThreat(board:Cell[],p:number,color:Color,size:number):number {
  if(board[p]) return 0
  const x=p%size,y=Math.floor(p/size);let score=0
  for(const [dx,dy] of directions) {
    let count=1,open=0
    for(const sign of [-1,1]) for(let k=1;k<=5;k++) {
      const nx=x+sign*dx*k,ny=y+sign*dy*k
      if(nx<0||ny<0||nx>=size||ny>=size) break
      const v=board[ny*size+nx]
      if(v===color) count++
      else {if(!v) open++;break}
    }
    if(count>=5) return 1_000_000
    if(count===4) score+=open===2?100_000:open===1?12_000:0
    if(count===3) score+=open===2?4_000:open===1?300:0
    if(count===2) score+=open===2?160:open===1?30:0
    // Five-cell windows also recognize gapped threats, e.g. XX.XX.
    for(let offset=-4;offset<=0;offset++) {
      let own=0,valid=true
      for(let j=offset;j<offset+5;j++) {
        const nx=x+dx*j,ny=y+dy*j
        if(nx<0||ny<0||nx>=size||ny>=size) {valid=false;break}
        const v=board[ny*size+nx]
        if(v===other(color)) {valid=false;break}
        if(v===color||j===0) own++
      }
      if(valid) score += [0,1,8,100,2_000,1_000_000][own]
    }
  }
  return score
}
export function gomokuCandidates(board:Cell[],size:number,color:Color):Candidate[] {
  const points=new Set<number>()
  for(let p=0;p<board.length;p++) if(board[p]) {
    const x=p%size,y=Math.floor(p/size)
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
      const nx=x+dx,ny=y+dy
      if(nx>=0&&nx<size&&ny>=0&&ny<size&&!board[ny*size+nx]) points.add(ny*size+nx)
    }
  }
  if(!points.size&&!board.some(Boolean)) points.add(Math.floor(board.length/2))
  return [...points].map(point=>{
    const attack=gomokuThreat(board,point,color,size),defend=gomokuThreat(board,point,other(color),size)
    const central= size-Math.abs(point%size-(size-1)/2)-Math.abs(Math.floor(point/size)-(size-1)/2)
    return {point,score:attack>=1e6?1e9:defend>=1e6?1e8:attack+defend*.92+central,
      reason:attack>=1e6?'这一步可以连成五颗':defend>=1e6?'挡住对方下一手连五':attack>=12000?'形成四子威胁':defend>=4000?'留意对方的连线':'连接棋形，保留延伸空间'}
  }).sort((a,b)=>b.score-a.score)
}
function gomokuEval(board:Cell[],size:number,color:Color) {
  const a=gomokuCandidates(board,size,color),b=gomokuCandidates(board,size,other(color))
  // Scores use both offense and defense for ordering; evaluation must use each side's own threats.
  const own=a.slice(0,8).map(c=>gomokuThreat(board,c.point,color,size)).sort((x,y)=>y-x)
  const opp=b.slice(0,8).map(c=>gomokuThreat(board,c.point,other(color),size)).sort((x,y)=>y-x)
  return (own[0]||0)+(own[1]||0)*.3-(opp[0]||0)*1.08-(opp[1]||0)*.3
}
function analyzeGomoku(state:Position,level:Level,rng:()=>number,deadline:number):Analysis {
  const start=performance.now(),board=state.board.slice(),roots=gomokuCandidates(board,state.size,state.turn)
  let nodes=0, best=roots[0]?.point??null
  if(!roots.length) return {move:null,suggestions:[],blackWinrate:50,nodes,elapsed:performance.now()-start}
  if(level===0) best=roots[Math.min(roots.length-1,Math.floor(rng()*Math.min(roots.length,8)))].point
  else if(roots[0].score<1e8) {
    const widths=[0,5,6,7,8],depths=[0,1,2,3,4],limit=widths[level]
    const expired={}
    const search=(color:Color,depth:number,alpha:number,beta:number):number=>{
      if(++nodes%32===0&&performance.now()>deadline) throw expired
      if(depth<=0) return gomokuEval(board,state.size,color)
      const moves=gomokuCandidates(board,state.size,color).slice(0,limit)
      if(!moves.length) return 0
      let value=-Infinity
      for(const c of moves) {
        board[c.point]=color;let v:number
        try {v=lineAt(board,c.point,state.size).length?10_000_000+depth*1000:-search(other(color),depth-1,-beta,-alpha)}
        finally {board[c.point]=0}
        value=Math.max(value,v);alpha=Math.max(alpha,v);if(alpha>=beta) break
      }
      return value
    }
    for(let depth=1;depth<=depths[level];depth++) {
      let nextBest=best,score=-Infinity
      try {
        for(const c of roots.slice(0,limit+2)) {
          board[c.point]=state.turn;let v:number
          try {v=-search(other(state.turn),depth-1,-Infinity,Infinity)} finally {board[c.point]=0}
          if(v>score) {score=v;nextBest=c.point}
        }
        best=nextBest
      } catch(e) {if(e!==expired) throw e;break}
    }
  }
  const evaluation=gomokuEval(state.board,state.size,1)
  const blackWinrate=state.moves.length<2?50:Math.round(100/(1+Math.exp(-Math.max(-3.5,Math.min(3.5,evaluation/14000)))))
  return {move:best,suggestions:roots.slice(0,2),blackWinrate,nodes,elapsed:performance.now()-start}
}
function eye(board:Cell[],p:number,size:number,color:Color) {
  if(!neighbors(p,size).every(n=>board[n]===color)) return false
  const x=p%size,y=Math.floor(p/size);let bad=0,edge=false
  for(const dx of [-1,1]) for(const dy of [-1,1]) {
    const nx=x+dx,ny=y+dy
    if(nx<0||nx>=size||ny<0||ny>=size) edge=true
    else if(board[ny*size+nx]===other(color)) bad++
  }
  return bad <= (edge?0:1)
}
type GoCandidate = Candidate & {board:Cell[]}
function goCandidates(board:Cell[],size:number,color:Color,seen:readonly string[]|Set<string>,points?:number[]):GoCandidate[] {
  const result:GoCandidate[]=[],groups=new Map<number,ReturnType<typeof groupAt>>()
  for(let p=0;p<board.length;p++) if(board[p]&&!groups.has(p)) {
    const g=groupAt(board,p,size);g.stones.forEach(s=>groups.set(s,g))
  }
  for(const p of points || board.map((_,i)=>i)) {
    if(board[p]) continue
    const placed=placeGo(board,size,p,color,seen);if(placed.error!==undefined) continue
    const adjacent=neighbors(p,size),own=new Set(adjacent.filter(n=>board[n]===color).map(n=>groups.get(n)!)),opp=new Set(adjacent.filter(n=>board[n]===other(color)).map(n=>groups.get(n)!))
    const liberties=groupAt(placed.board,p,size).liberties.size
    const saved=[...own].filter(g=>g.liberties.size===1&&liberties>1).reduce((s,g)=>s+g.stones.size,0)
    const atari=[...opp].filter(g=>g.liberties.size===2).reduce((s,g)=>s+g.stones.size,0)
    const x=p%size,y=Math.floor(p/size),edge=Math.min(x,y,size-1-x,size-1-y)
    let nearest=99
    for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
      const nx=x+dx,ny=y+dy
      if(nx>=0&&nx<size&&ny>=0&&ny<size&&board[ny*size+nx]) nearest=Math.min(nearest,Math.abs(dx)+Math.abs(dy))
    }
    let score=placed.captured.length*40+saved*32+atari*8+Math.min(liberties,4)*1.8
    score+=edge===2?6:edge===3?5:edge===1?0:edge===0?-6:2
    score+=nearest===2?5:nearest===3?4:nearest===1?1:0
    score+=own.size>1?3:0
    if(liberties===1) score-=32+groupAt(placed.board,p,size).stones.size*6
    if(eye(board,p,size,color)) score-=90
    result.push({point:p,board:placed.board,score,reason:placed.captured.length?`提掉 ${placed.captured.length} 子`:saved?'为被叫吃的棋增加气':atari?'压缩对方棋子的气':nearest===2?'与附近的棋保持联系':'占据空处，向外展开'})
  }
  return result.sort((a,b)=>b.score-a.score)
}
// Spatial influence is a bounded-horizon heuristic, not final territory or calibrated probability.
export function goEvaluation(board:Cell[],size:number,komi:number) {
  let value=-komi
  const visited=new Set<number>()
  for(let p=0;p<board.length;p++) {
    if(board[p]) {
      value+=board[p]===1?1:-1
      if(!visited.has(p)) {
        const g=groupAt(board,p,size);g.stones.forEach(n=>visited.add(n))
        if(g.liberties.size===1) value+=(board[p]===1?-1:1)*g.stones.size*1.4
      }
    } else {
      let black=0,white=0;const x=p%size,y=Math.floor(p/size)
      for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
        const d=Math.abs(dx)+Math.abs(dy),nx=x+dx,ny=y+dy
        if(d===0||d>3||nx<0||ny<0||nx>=size||ny>=size) continue
        const c=board[ny*size+nx],w=1/(d*d)
        if(c===1) black+=w;else if(c===2) white+=w
      }
      if(black+white) value+=(black-white)/(black+white+.8)
    }
  }
  return value
}
function analyzeGo(state:Position,level:Level,rng:()=>number,deadline:number):Analysis {
  const start=performance.now(),roots=goCandidates(state.board,state.size,state.turn,state.hashes)
  const evaluate=goEvaluation(state.board,state.size,state.komi)
  const blackWinrate=Math.round(100/(1+Math.exp(-evaluate/(state.size===9?12:28))))
  const suggestions=roots.filter(c=>c.score>-20).slice(0,2).map(({point,score,reason})=>({point,score,reason}))
  if(!roots.length||roots[0].score<-15||(state.passes&&state.moves.length>state.size*state.size*.6&&roots[0].score<12))
    return {move:null,suggestions,blackWinrate,nodes:roots.length,elapsed:performance.now()-start}
  if(level===0) return {move:roots[Math.floor(rng()*Math.min(12,roots.length))].point,suggestions,blackWinrate,nodes:roots.length,elapsed:performance.now()-start}
  const candidates=roots.slice(0,[0,4,6,8,10][level]), stats=candidates.map(()=>({visits:0,total:0})),rolloutDepth=[0,0,4,8,12][level]
  let nodes=roots.length,iterations=0
  const maxIterations=[0,0,24,48,90][level]
  while(iterations<maxIterations&&performance.now()<deadline) {
    let selected=stats.findIndex(s=>s.visits===0)
    if(selected<0) {
      let best=-Infinity
      stats.forEach((s,i)=>{const v=s.total/s.visits+1.1*Math.sqrt(Math.log(iterations+1)/s.visits);if(v>best){best=v;selected=i}})
    }
    let board=candidates[selected].board,color=other(state.turn),passes=0
    const seen=new Set(state.hashes);seen.add(hash(board))
    for(let depth=0;depth<rolloutDepth&&performance.now()<deadline;depth++) {
      // Sample empty intersections, plus all atari liberties for tactical continuity.
      const points=new Set<number>(),groupSeen=new Set<number>()
      for(let p=0;p<board.length;p++) if(board[p]&&!groupSeen.has(p)) {
        const g=groupAt(board,p,state.size);g.stones.forEach(s=>groupSeen.add(s))
        if(g.liberties.size<=2) g.liberties.forEach(s=>points.add(s))
      }
      for(let i=0;i<28;i++) {const p=Math.floor(rng()*board.length);if(!board[p]) points.add(p)}
      const options=goCandidates(board,state.size,color,seen,[...points]);nodes+=options.length
      if(!options.length||options[0].score<-15) {if(++passes===2) break;color=other(color);continue}
      passes=0
      const choice=options[0].score>25?options[0]:options[Math.floor(rng()*Math.min(3,options.length))]
      board=choice.board;seen.add(hash(board));color=other(color)
    }
    const value=passes===2?areaScore({board,size:state.size,komi:state.komi}).margin:goEvaluation(board,state.size,state.komi)
    stats[selected].visits++;stats[selected].total+=1/(1+Math.exp(-(state.turn===1?value:-value)/(state.size===9?10:20)));iterations++
  }
  let best=0,score=-Infinity
  candidates.forEach((c,i)=>{
    const s=stats[i],v=c.score*.018+(s.visits?s.total/s.visits:.5)
    if(v>score) {score=v;best=i}
  })
  return {move:candidates[best].point,suggestions,blackWinrate,nodes,elapsed:performance.now()-start}
}
export function analyze(state:Position,level:Level,rng:()=>number=Math.random,budget?:number):Analysis {
  const start=performance.now(),deadline=start+(budget??[80,120,400,850,1500][level])
  if(state.phase!=='playing') return {move:null,suggestions:[],blackWinrate:state.winner===1?100:state.winner===2?0:50,nodes:0,elapsed:0}
  return state.kind==='gomoku'?analyzeGomoku(state,level,rng,deadline):analyzeGo(state,level,rng,deadline)
}
