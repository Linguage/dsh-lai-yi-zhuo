import { chooseClimb } from './climbing.ts'
import { chooseTractor } from './tractor.ts'
self.onmessage=event=>{try{const d=event.data;self.postMessage({action:d.kind==='tractor'?chooseTractor(d.observation,d.level):chooseClimb(d.observation,d.level)})}catch{self.postMessage({error:'计算中断，请重试'})}}
