export type IconName='back'|'robot'|'person'|'book'|'bulb'|'undo'|'pass'|'more'|'close'|'sound'|'flag'|'refresh'|'chevron'
const paths:Record<IconName,React.ReactNode>={
  back:<path d="m14 5-7 7 7 7"/>,
  robot:<><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 7V4M2 12v4m20-4v4m-13 0c2 2 4 2 6 0"/><circle cx="12" cy="3" r="1"/><path d="M8 11v1m8-1v1"/></>,
  person:<><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/></>,
  book:<><path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></>,
  bulb:<><path d="M9 19h6m-5 3h4M8 15c-5-4-2-12 4-12s9 8 4 12l-1 2H9Z"/><path d="M12 7v3"/></>,
  undo:<><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/></>,
  pass:<><path d="m4 5 8 7-8 7Zm9 0 8 7-8 7Z"/></>,
  more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  close:<path d="m6 6 12 12M6 18 18 6"/>,
  sound:<><path d="M4 9h4l5-5v16l-5-5H4Zm13-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></>,
  flag:<><path d="M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0"/></>,
  refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 7a8 8 0 0 1 14 1M5 16a8 8 0 0 0 14 1"/></>,
  chevron:<path d="m9 5 7 7-7 7"/>
}
export function Icon({name}:{name:IconName}) {return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>}
