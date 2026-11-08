import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { newTable, tableKey, encodeTable, restoreTable, tableAct } from '../ui/table-session.ts'
import { chooseCards, observeCards } from '../ui/guandan.ts'
import { chooseMahjong, observeMahjong, tileName, claimsFor } from '../ui/mahjong.ts'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BOARD_GAMES_URL || 'http://127.0.0.1:7346/board-games/'
await mkdir('artifacts/qa', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true })
const errors = [], external = [], results = []
const load = async (page, kind) => restoreTable(await page.evaluate(key => localStorage.getItem(key), tableKey(kind)), kind)
async function seed(page, session) {
  await page.evaluate(({key, raw, group}) => { localStorage.setItem(key,raw);sessionStorage.setItem('dsh-table-group',group) }, { key:tableKey(session.kind),raw:encodeTable(session),group:session.kind })
  await page.reload();await page.getByRole('button',{name:`继续上次的${session.kind==='guandan'?'掼蛋':'麻将'}`,exact:false}).click()
}
async function humanTurn(page) {
  await page.waitForFunction(()=>!!document.querySelector('.seat-0.active-seat')||!!document.querySelector('.four-result'),{},{timeout:20000})
}
function recommend(s) {
  if(s.kind==='guandan'){const m=chooseCards(observeCards(s.state,0),3);return {game:'guandan',cards:m?.cards??null,shapeKey:m?.key}}
  return {game:'mahjong',action:chooseMahjong(observeMahjong(s.state,0),3)}
}
async function humanPlay(page,kind) {
  await humanTurn(page);const s=await load(page,kind);assert.notEqual(s.state.phase,'finished')
  const action=recommend(s)
  if(action.game==='guandan'){
    if(action.cards===null) await page.getByRole('button',{name:'不出',exact:true}).click()
    else {
      for(const card of action.cards)await page.locator(`button[data-card="${card}"]`).click({position:{x:7,y:23}})
      if(await page.getByLabel('选择牌型').count())await page.getByLabel('选择牌型').selectOption(action.shapeKey)
      await page.getByRole('button',{name:'出牌',exact:true}).click()
    }
  }else{
    const a=action.action
    if(a.kind==='discard')await page.getByRole('button',{name:`打出${tileName(a.tile)}`,exact:true}).first().click()
    else if(a.kind==='pass')await page.getByRole('button',{name:'过',exact:true}).click()
    else if(a.kind==='hu')await page.getByRole('button',{name:'胡',exact:true}).click()
    else if(a.kind==='chi'){
      const index=claimsFor(s.state,0).filter(c=>c.kind==='chi').findIndex(c=>c.tiles.join(',')===a.tiles.join(','))
      await page.getByRole('button',{name:/^吃/}).nth(index).click()
    }else await page.getByRole('button',{name:new RegExp(`^${({peng:'碰',gang:'杠',concealed:'暗杠',add:'补杠'})[a.kind]}`)}).first().click()
  }
  await page.waitForFunction(({key,step})=>JSON.parse(localStorage.getItem(key)).actions.length>step,{key:tableKey(kind),step:s.actions.length})
  return s
}
async function geometry(page) {
  const table=await page.locator('.four-square').boundingBox();assert.ok(Math.abs(table.width-table.height)<1,'table must be square')
  const seat=await page.locator('.seat-0').boundingBox();assert.ok(seat.y>table.y+table.height*.8,'human below table')
  assert.equal(await page.locator('.four-seat').count(),4)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow')
}
try {
  for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:720},{width:768,height:1024}]){
    const context=await browser.newContext({viewport,hasTouch:viewport.width<500}),page=await context.newPage()
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url())})
    await page.goto(base);assert.equal(await page.locator('.table-choice').count(),3)
    await page.screenshot({path:`artifacts/qa/lobby-${viewport.width}.png`,fullPage:true})
    for(const kind of ['guandan','mahjong']){
      await page.getByRole('button',{name:`进入${kind==='guandan'?'牌桌':'麻将桌'}`,exact:true}).click()
      await page.getByRole('button',{name:kind==='guandan'?'选择掼蛋':'选择基础麻将',exact:true}).click()
      await geometry(page)
      await page.getByRole('button',{name:'1 档 入门',exact:true}).click()
      await page.screenshot({path:`artifacts/qa/${kind}-setup-${viewport.width}.png`,fullPage:true})
      await page.getByRole('button',{name:'开始练习',exact:false}).click()
      // Use a reproducible real deal for gameplay and a stable visual review.
      await seed(page,newTable(kind,1,612))
      assert.equal(await page.locator('.public-reference').count(),0)
      await page.getByRole('button',{name:'开启建议',exact:true}).click()
      await page.waitForFunction(()=>!!document.querySelector('.hint-card,.hint-tile'))
      await page.getByRole('button',{name:'关闭建议',exact:true}).click()
      const before=await humanPlay(page,kind);await humanTurn(page);await geometry(page)
      await page.screenshot({path:`artifacts/qa/${kind}-${viewport.width}.png`,fullPage:true})
      await page.getByRole('button',{name:'悔牌（剩余 1 次）',exact:true}).click()
      assert.deepEqual((await load(page,kind)).state,before.state)
      assert(await page.getByRole('button',{name:'悔牌（剩余 0 次）',exact:true}).isDisabled())
      await page.reload();await page.getByRole('button',{name:/继续上次的/}).click()
      assert(await page.getByRole('button',{name:'悔牌（剩余 0 次）',exact:true}).isDisabled())
      await humanPlay(page,kind);await humanTurn(page)
      assert(await page.getByRole('button',{name:'悔牌（剩余 1 次）',exact:true}).isEnabled())
      await page.getByRole('button',{name:'更多',exact:true}).click()
      await page.getByRole('switch',{name:kind==='guandan'?'出牌进度':'向听数参考',exact:true}).click()
      await page.locator('.public-reference').waitFor()
      await page.getByRole('switch',{name:kind==='guandan'?'出牌进度':'向听数参考',exact:true}).click()
      await page.getByRole('button',{name:'更多',exact:true}).click()
      await page.getByRole('button',{name:'规则',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(),0)
      await page.getByRole('button',{name:'返回选桌',exact:true}).click()
      await page.getByRole('button',{name:'返回选桌',exact:true}).click()
    }
    // Preserve existing chess entry and local save alongside both four-player games.
    await page.getByRole('button',{name:'进入棋桌',exact:true}).click();assert.equal(await page.getByRole('button',{name:'选择五子棋',exact:true}).count(),1)
    await context.close();results.push({viewport,square:true,seats:4,play:true,hints:true,undo:true,resume:true,referenceToggle:true})
  }
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base)
  for(const kind of ['guandan','mahjong']){
    await seed(page,newTable(kind,0,612))
    const first=await humanPlay(page,kind);await humanTurn(page)
    const second=await humanPlay(page,kind);await humanTurn(page)
    await page.getByRole('button',{name:'悔牌（剩余 2 次）',exact:true}).click();assert.deepEqual((await load(page,kind)).state,second.state)
    await page.getByRole('button',{name:'悔牌（剩余 1 次）',exact:true}).click();assert.deepEqual((await load(page,kind)).state,first.state)
    assert(await page.getByRole('button',{name:'悔牌（剩余 0 次）',exact:true}).isDisabled())
    await humanPlay(page,kind)
    // Leave while an AI response is queued. It must not mutate the save off-screen.
    await page.getByRole('button',{name:'返回选桌',exact:true}).click();const offscreen=await page.evaluate(key=>localStorage.getItem(key),tableKey(kind))
    await page.waitForTimeout(900);assert.equal(await page.evaluate(key=>localStorage.getItem(key),tableKey(kind)),offscreen)
    await seed(page,newTable(kind,2,612));assert.equal(await page.getByRole('button',{name:/悔牌/}).count(),0)
  }
  // Find a genuine replayable Mahjong response and end state, exercising context actions.
  let response=null,end=null
  for(let seedValue=1;seedValue<30&&!response;seedValue++){
    let s=newTable('mahjong',2,seedValue)
    for(let n=0;n<250&&s.state.phase!=='finished';n++){
      const seat=s.state.turn,o=observeMahjong(s.state,seat),a=chooseMahjong(o,2)
      if(seat===0&&s.state.phase==='claims'&&o.claims.some(c=>c.kind==='peng'||c.kind==='chi'))response=s
      s=tableAct(s,seat,{game:'mahjong',action:a}).session
    }
    end=s
  }
  assert(response);await seed(page,response);assert(await page.getByRole('button',{name:'过',exact:true}).isEnabled())
  await page.screenshot({path:'artifacts/qa/mahjong-claims.png',fullPage:true})
  await humanPlay(page,'mahjong');await humanTurn(page)
  // Finished saves open the setup screen; completed game can still be rendered through final action.
  let beforeEnd=newTable('mahjong',end.level,end.seed)
  for(const entry of end.actions.slice(0,-1))beforeEnd=tableAct(beforeEnd,entry.seat,entry.action).session
  await seed(page,beforeEnd)
  if(beforeEnd.state.turn===0)await humanPlay(page,'mahjong')
  await page.locator('.four-result').waitFor({timeout:15000})
  await page.screenshot({path:'artifacts/qa/mahjong-result.png',fullPage:true})
  await context.close()
  assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  const report={passed:true,results,consecutiveUndo:true,cancelStaleAI:true,mahjongClaims:true,mahjongEnd:true,errors,externalRequests:external}
  await writeFile('artifacts/qa/tables-browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
}finally{await browser.close()}
