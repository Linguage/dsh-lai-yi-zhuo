window.__ModuleLoader__.load({ id: 'dsh-lai-yi-zhuo', factory: require => {
  const React = require('react'), h = React.createElement
  function Icon(props) {
    return h('svg', { width: props?.size || 18, height: props?.size || 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
      h('rect', {x:2,y:2,width:20,height:20,rx:4}), h('path',{d:'M8 3v18M16 3v18M3 8h18M3 16h18'}),
      h('circle',{cx:8,cy:8,r:3,fill:'currentColor'}), h('circle',{cx:16,cy:16,r:3,fill:'var(--background-color, #eee)'}))
  }
  function Panel() {
    return h('iframe', { src:'/board-games/', title:'来一桌 · 棋桌、牌桌与麻将桌', style:{width:'100%',height:'100%',minHeight:0,border:0,display:'block'} })
  }
  return { isPlugin:true, name:'board-games', inject:['slots'], apply(ctx) {
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({name:'sidebar.panellist',id:'board-games',order:68,label:()=>'来一桌'},Icon))
    ctx.slots.inject('main', () => ctx.slots.register({name:'main',key:'board-games'},Panel))
  } }
} })
