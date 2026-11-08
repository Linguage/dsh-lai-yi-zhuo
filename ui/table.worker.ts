import { chooseCards } from './guandan.ts'
import type { CardObservation } from './guandan.ts'
import { chooseMahjong, shanten } from './mahjong.ts'
import type { MahjongObservation } from './mahjong.ts'
import type { Level } from './game.ts'
self.onmessage = (event: MessageEvent<{ kind: 'guandan'; observation: CardObservation; level: Level } | { kind: 'mahjong'; observation: MahjongObservation; level: Level }>) => {
  try {
    const data = event.data
    if (data.kind === 'guandan') {
      const move = chooseCards(data.observation, data.level)
      self.postMessage({ action: { game: 'guandan', cards: move?.cards ?? null, shapeKey: move?.key }, label: move?.label ?? '让同伴领出 / 暂不出牌' })
    } else {
      const action = chooseMahjong(data.observation, data.level)
      self.postMessage({ action: { game: 'mahjong', action }, distance: shanten(data.observation.hand, data.observation.melds.length) })
    }
  } catch { self.postMessage({ error: '计算中断，请重试' }) }
}
