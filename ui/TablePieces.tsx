import { cardRank, cardSuit, isWild, rankLabel, suitLabels, cardLabel } from './guandan.ts'
import { tileType, tileName } from './mahjong.ts'
import { Icon } from './icons.tsx'
import type { SeatId } from './guandan.ts'

export const seatNames = ['你', '右侧 AI', '对家 AI', '左侧 AI']
export function PlayingCard({ card, back = false, small = false, wild = true }: { card?: number; back?: boolean; small?: boolean; wild?:boolean }) {
  if (back || card === undefined) return <span className={`playing-card card-back ${small ? 'small-card' : ''}`} aria-hidden="true"><i/></span>
  const rank = cardRank(card), suit = cardSuit(card), red = suit === 1 || suit === 3 || rank === 17
  return <span className={`playing-card ${red ? 'red-card' : ''} ${wild && isWild(card) ? 'wild-card' : ''} ${small ? 'small-card' : ''}`} aria-label={wild ? cardLabel(card) : cardLabel(card).replace(' 配牌','')}>
    <span className="card-corner"><b>{rankLabel(rank)}</b><i>{suit >= 0 ? suitLabels[suit] : '★'}</i></span>
    <span className="card-center" aria-hidden="true">{suit >= 0 ? suitLabels[suit] : '♛'}</span>
    {wild && isWild(card) && <span className="wild-mark">配</span>}
  </span>
}
export function MahjongTile({ tile, back = false, tiny = false }: { tile?: number; back?: boolean; tiny?: boolean }) {
  if (back || tile === undefined) return <span className={`mahjong-tile tile-back ${tiny ? 'tiny-tile' : ''}`} aria-hidden="true"/>
  const type = tileType(tile), n = type % 9 + 1, suit = Math.floor(type / 9)
  return <span className={`mahjong-tile tile-suit-${suit} ${tiny ? 'tiny-tile' : ''}`} aria-label={tileName(tile)}>
    {type < 9 ? <span className="wan-face"><b>{['一','二','三','四','五','六','七','八','九'][type]}</b><em>萬</em></span>
      : type < 27 ? <svg viewBox="0 0 30 40" aria-hidden="true">{Array.from({ length: n }, (_, i) => {
        const cols = n <= 3 ? 1 : n <= 6 ? 2 : 3, rows = Math.ceil(n / cols)
        const x = cols === 1 ? 15 : 7 + i % cols * 16 / (cols - 1), y = rows === 1 ? 20 : 7 + Math.floor(i / cols) * 26 / (rows - 1)
        return suit === 1 ? <circle key={i} cx={x} cy={y} r={n === 1 ? 8 : 3.1} fill="none" stroke={i === 0 ? '#ae3b31' : '#275d67'} strokeWidth="1.8"/> : <path key={i} d={`M${x-1.7} ${y-3}v6m3.4-6v6M${x-2.3} ${y}h4.6`} fill="none" stroke={n === 1 ? '#b33c32' : '#356646'} strokeWidth="1.6" strokeLinecap="round"/>
      })}</svg> : <b className={`honor-face honor-${type}`}>{['東','南','西','北','中','發','▯'][type - 27]}</b>}
  </span>
}
export function FourSeat({ seat, active, team, count, finished }: { seat: SeatId; active: boolean; team: boolean; count: number; finished?: number }) {
  return <div className={`four-seat seat-${seat} ${active ? 'active-seat' : ''} ${team && seat % 2 === 0 ? 'partner-seat' : ''}`} aria-label={`${seatNames[seat]}${team && seat === 2 ? '，同伴' : ''}，${count} 张${active ? '，当前回合' : ''}`}>
    <span className="player-token"><Icon name={seat === 0 ? 'person' : 'robot'}/><i className="active-dot"/></span>
    <span className="seat-detail">{finished ? `${finished} 游` : count}{team && seat % 2 === 0 && <i title="同队">♣</i>}</span>
  </div>
}
