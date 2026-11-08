import { analyzeRoyal } from './royal.ts'
self.onmessage = event => { try { self.postMessage(analyzeRoyal(event.data.session,event.data.level)) } catch { self.postMessage({error:'计算中断，请重试'}) } }
