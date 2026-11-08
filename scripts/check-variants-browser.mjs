import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {royalKey,restoreRoyal,royalMoves,royalPosition,squareName} from '../ui/royal.ts'
import {addedCardKey,restoreCardsSession,addedCardNames} from '../ui/cards-session.ts'
import {chooseClimb,observeClimb} from '../ui/climbing.ts'
import {chooseTractor,observeTractor,trumpName} from '../ui/tractor.ts'
import {tableKey,restoreTable} from '../ui/table-session.ts'
import {chooseMahjong,observeMahjong,tileName,mahjongNames,claimsFor} from '../ui/mahjong.ts'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.BOARD_GAMES_URL||'http://127.0.0.1:7346/board-games/'
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true})
await mkdir('artifacts/qa',{recursive:true})
const errors=[],external=[],results=[];let active
const get=async(page,key)=>page.evaluate(key=>localStorage.getItem(key),key)
const readCards=async(page,kind)=>restoreCardsSession(await get(page,addedCardKey(kind)),kind)
const readMj=async(page,variant)=>restoreTable(await get(page,tableKey('mahjong',variant)),'mahjong',variant)
const waitHuman=async page=>page.waitForFunction(()=>!!document.querySelector('.seat-0.active-seat')||!!document.querySelector('.four-result'),{},{timeout:20000})
async function checkLayout(page,seats){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow')
 if(seats){assert.equal(await page.locator('.four-seat').count(),seats);const b=await page.locator('.four-square').boundingBox();assert(Math.abs(b.width-b.height)<1);const human=await page.locator('.seat-0').boundingBox();assert(human.y>b.y+b.height*.8)}
}
async function selectCards(page,cards){for(const c of cards)await page.locator(`[data-card="${c}"]`).click({position:{x:3,y:15}})}
async function playCards(page,kind){
 await waitHuman(page);const s=await readCards(page,kind);assert.notEqual(s.state.phase,'finished');const state=s.state,a=kind==='tractor'?chooseTractor(observeTractor(state,0),2):chooseClimb(observeClimb(state,0),2)
 if(a.type==='bid')await page.getByRole('button',{name:a.value?`${a.value} 分`:'不叫',exact:true}).click()
 else if(a.type==='declare'){
  if(!a.cards)await page.getByRole('button',{name:'不亮',exact:true}).click()
  else {const {declarations}=await import('../ui/tractor.ts');const d=declarations(state.hands[0]).find(d=>d.cards.join(',')===a.cards.join(','));await page.getByRole('button',{name:trumpName(d.suit)+(d.cards.length===2?' · 双张':''),exact:true}).click()}
 }else if(a.cards===null)await page.getByRole('button',{name:'不出',exact:true}).click()
 else {await selectCards(page,a.cards);if(a.key&&await page.getByLabel('选择牌型').count())await page.getByLabel('选择牌型').selectOption(a.key);await page.getByRole('button',{name:a.type==='bury'?'扣底 8/8':'出牌',exact:true}).click()}
 await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).actions.length>n,{key:addedCardKey(kind),n:s.actions.length});return s
}
async function playMj(page,variant){
 await waitHuman(page);const s=await readMj(page,variant),a=chooseMahjong(observeMahjong(s.state,0),2);assert.notEqual(s.state.phase,'finished')
 if(a.kind==='exchange'){
  // Duplicates are distinct physical tiles; click by rack index.
  for(const t of a.tiles)await page.locator('.hand-tile').nth(s.state.hands[0].indexOf(t)).click()
  await page.getByRole('button',{name:'换三张 3/3',exact:true}).click()
 }else if(a.kind==='missing')await page.getByRole('button',{name:`缺${['万','筒','条'][a.suit]}`,exact:true}).click()
 else if(a.kind==='discard')await page.locator('.hand-tile').nth(s.state.hands[0].indexOf(a.tile)).click()
 else if(a.kind==='pass')await page.getByRole('button',{name:'过',exact:true}).click()
 else if(a.kind==='hu')await page.getByRole('button',{name:'胡',exact:true}).click()
 else await page.getByRole('button',{name:new RegExp('^'+({peng:'碰',gang:'杠',concealed:'暗杠',add:'补杠',chi:'吃'})[a.kind])}).first().click()
 await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).actions.length>n,{key:tableKey('mahjong',variant),n:s.actions.length});return s
}
try{
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:720},{width:768,height:1024}]){
  const context=await browser.newContext({viewport}),page=active=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url())})
  await page.goto(base);await page.getByRole('button',{name:'进入棋桌',exact:true}).click();await checkLayout(page);assert.equal(await page.locator('.game-choice').count(),4);await page.screenshot({path:`artifacts/qa/chess-menu-${viewport.width}.png`,fullPage:true})
  for(const kind of ['xiangqi','chess']){
   await page.getByRole('button',{name:'选择'+(kind==='xiangqi'?'中国象棋':'国际象棋'),exact:true}).click();await page.getByRole('button',{name:'1 档 入门',exact:true}).click();await page.getByRole('button',{name:'开始对弈',exact:false}).click()
   assert.equal(await page.locator('.royal-cell').count(),kind==='xiangqi'?90:64);await page.getByRole('button',{name:'开启下棋建议',exact:true}).click();await page.locator('.suggested-square').first().waitFor();await page.getByRole('button',{name:'关闭下棋建议',exact:true}).click()
   const before=restoreRoyal(await get(page,royalKey(kind)),kind),move=royalMoves(before)[0]
   await page.getByRole('button',{name:new RegExp('^'+squareName(kind,move.from)+' ')}).click();assert(await page.locator('.legal-square').count()>0);await page.getByRole('button',{name:new RegExp('^'+squareName(kind,move.to)+' ')}).click();assert.equal(await page.getByRole('dialog').count(),0)
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).moves.length===2,royalKey(kind));await checkLayout(page);await page.screenshot({path:`artifacts/qa/${kind}-${viewport.width}.png`,fullPage:true})
   await page.getByRole('button',{name:'悔棋（剩余 1 次）',exact:true}).click();assert.deepEqual(restoreRoyal(await get(page,royalKey(kind)),kind).moves,[]);await page.reload();await page.getByRole('button',{name:'继续上次的'+(kind==='xiangqi'?'中国象棋':'国际象棋'),exact:true}).click();assert(await page.getByRole('button',{name:'悔棋（剩余 0 次）',exact:true}).isDisabled())
   await page.getByRole('button',{name:'返回棋桌',exact:true}).click()
  }
  await page.getByRole('button',{name:'返回选桌',exact:true}).click();await page.getByRole('button',{name:'进入牌桌',exact:true}).click();await checkLayout(page);await page.screenshot({path:`artifacts/qa/cards-menu-${viewport.width}.png`,fullPage:true})
  for(const kind of ['doudizhu','shuangkou','tractor']){
   await page.getByRole('button',{name:'选择'+addedCardNames[kind],exact:true}).click();await page.getByRole('button',{name:'1 档 入门',exact:true}).click();await page.getByRole('button',{name:'开始练习',exact:false}).click();await waitHuman(page)
   await page.getByRole('button',{name:'开启建议',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.four-status')?.textContent?.includes('建议')||!!document.querySelector('.hint-card'));await page.getByRole('button',{name:'关闭建议',exact:true}).click()
   let before
   for(let i=0;i<2;i++){before=await playCards(page,kind);await waitHuman(page)}
   await checkLayout(page,kind==='doudizhu'?3:4);await page.screenshot({path:`artifacts/qa/${kind}-${viewport.width}.png`,fullPage:true})
   await page.getByRole('button',{name:'悔牌（剩余 1 次）',exact:true}).click();assert.deepEqual((await readCards(page,kind)).state,before.state);await page.reload();await page.getByRole('button',{name:'继续上次的'+addedCardNames[kind],exact:true}).click();assert(await page.getByRole('button',{name:'悔牌（剩余 0 次）',exact:true}).isDisabled());await playCards(page,kind)
   await page.getByRole('button',{name:'返回牌桌',exact:true}).click()
  }
  await page.getByRole('button',{name:'返回选桌',exact:true}).click();await page.getByRole('button',{name:'进入麻将桌',exact:true}).click();await checkLayout(page);await page.screenshot({path:`artifacts/qa/mahjong-menu-${viewport.width}.png`,fullPage:true})
  for(const variant of ['sichuan','bloodflow','guangdong']){
   await page.getByRole('button',{name:'选择'+mahjongNames[variant],exact:true}).click();await page.getByRole('button',{name:'1 档 入门',exact:true}).click();await page.getByRole('button',{name:'开始练习',exact:false}).click();await waitHuman(page)
   await page.getByRole('button',{name:'开启建议',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('.hint-tile')||document.querySelector('.four-status')?.textContent?.includes('可以'));await page.getByRole('button',{name:'关闭建议',exact:true}).click()
   let before
   for(let i=0;i<(variant==='guangdong'?2:3);i++){before=await playMj(page,variant);await waitHuman(page)}
   await checkLayout(page,4);await page.screenshot({path:`artifacts/qa/${variant}-${viewport.width}.png`,fullPage:true})
   await page.getByRole('button',{name:'悔牌（剩余 1 次）',exact:true}).click();assert.deepEqual((await readMj(page,variant)).state,before.state);await page.reload();await page.getByRole('button',{name:'继续上次的'+mahjongNames[variant],exact:true}).click();assert(await page.getByRole('button',{name:'悔牌（剩余 0 次）',exact:true}).isDisabled());await playMj(page,variant)
   await page.getByRole('button',{name:'规则',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('button',{name:'返回选桌',exact:true}).click()
  }
  results.push({viewport,games:8,play:true,undo:true,resume:true,hints:true,overflow:false});console.log('Passed '+viewport.width+' × '+viewport.height);await context.close()
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const report={passed:true,results,errors,external};await writeFile('artifacts/qa/variants-browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
}catch(e){if(active&&!active.isClosed())await active.screenshot({path:'artifacts/qa/variants-failure.png',fullPage:true});throw e}finally{await browser.close()}
