import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@wyndbase/sdk/react'
import { Board, IssuePage, People, Projects, Requesters, Sprints } from './pages'
import { InboxPage } from './inbox'
import { Login, useMe, useRoles } from './session'
import { loginPath, session, wyndbase } from './wyndbase'

type Route =
  | { name: 'board' }
  | { name: 'issue'; id: string }
  | { name: 'projects' }
  | { name: 'sprints' }
  | { name: 'requesters' }
  | { name: 'inbox' }
  | { name: 'people' }

function parse(path: string): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'issue' && parts[1]) return { name: 'issue', id: parts[1] }
  if (parts[0] === 'projeler') return { name: 'projects' }
  if (parts[0] === 'sprintler') return { name: 'sprints' }
  if (parts[0] === 'talepler') return { name: 'requesters' }
  if (parts[0] === 'gelen') return { name: 'inbox' }
  if (parts[0] === 'ekip') return { name: 'people' }
  return { name: 'board' }
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return {
    path,
    route: parse(path),
    go(next: string) {
      window.history.pushState(null, '', next)
      setPath(next)
    },
  }
}

export function App() {
  const { path } = useRoute()
  if (path.startsWith(loginPath)) return <Login />
  return <Desk />
}

function Desk() {
  const signedIn = useAuthStore((state) => state.isAuthenticated)
  const { route, go } = useRoute()

  useEffect(() => {
    if (signedIn !== false || session.isReturning()) return
    const next = window.location.pathname + window.location.search
    window.location.assign(`${loginPath}?redirect=${encodeURIComponent(next)}`)
  }, [signedIn])

  if (signedIn !== true) {
    return <main className="grid min-h-screen place-items-center text-sm text-stone-500">Oturum açılıyor…</main>
  }
  return <Shell route={route} go={go} />
}

const nav = [
  ['/', 'Pano'],
  ['/projeler', 'Projeler'],
  ['/sprintler', 'Sprintler'],
  ['/talepler', 'Talepler'],
  ['/gelen', 'Gelen'],
] as const

function Shell({ route, go }: { route: Route; go: (path: string) => void }) {
  const roles = useRoles()
  const me = useMe()
  const inbox = useQuery(wyndbase.inbox.unread.options())
  const waiting = inbox.data?.total ?? 0
  const name = me.data?.name || me.data?.username || 'Hesap'

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="bg-ink text-stone-100 md:min-h-screen">
        <div className="px-5 py-6">
          <p className="font-serif text-3xl">Pano</p>
          <p className="text-xs tracking-wide text-stone-400">Issue tracker</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:block md:space-y-1">
          {nav.map(([href, text]) => {
            const active = href === '/' ? route.name === 'board' : window.location.pathname.startsWith(href)
            return (
              <button
                key={href}
                onClick={() => go(href)}
                className={`block whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm ${active ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}
              >
                {text}
                {href === '/gelen' && waiting > 0 ? <span className="ml-2 rounded-full bg-rose-500 px-1.5 text-xs text-white">{waiting}</span> : null}
              </button>
            )
          })}
          {roles.govern ? (
            <button
              onClick={() => go('/ekip')}
              className={`block rounded-xl px-3 py-2 text-left text-sm ${route.name === 'people' ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}
            >
              Ekip
            </button>
          ) : null}
        </nav>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="text-sm text-stone-500">{name}</p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-stone-500">{roles.label}</p>
            <button className="text-sm underline" onClick={() => void wyndbase.auth.logout({ scope: 'app' })}>
              Çıkış
            </button>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6">
          {route.name === 'board' ? <Board go={go} /> : null}
          {route.name === 'issue' ? <IssuePage id={route.id} go={go} /> : null}
          {route.name === 'projects' ? <Projects /> : null}
          {route.name === 'sprints' ? <Sprints /> : null}
          {route.name === 'requesters' ? <Requesters /> : null}
          {route.name === 'inbox' ? <InboxPage /> : null}
          {route.name === 'people' ? <People /> : null}
        </main>
      </div>
    </div>
  )
}
