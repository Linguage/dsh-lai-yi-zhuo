import { analyze } from './ai.ts'
import type { Position, Level } from './game.ts'
self.onmessage=(event:MessageEvent<{state:Position;level:Level}>)=>{
  try { self.postMessage({analysis:analyze(event.data.state,event.data.level)}) }
  catch(error) { self.postMessage({error:error instanceof Error?error.message:'计算失败'}) }
}
