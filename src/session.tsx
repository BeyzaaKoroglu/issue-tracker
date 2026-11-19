import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@wyndbase/sdk/react'
import { useRead } from './data'
import { roleLabel, type Me } from './model'
import { errorText, session, wyndbase } from './wyndbase'
import { Banner, Button } from './ui'

function localTarget(value: string | null | undefined) {
  if (!value) return '/'
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (url.origin !== window.location.origin) return '/'
    return localTarget(url.searchParams.get('redirect'))
  } catch {
    return '/'
  }
}

const returnLeg = session.handleCallback()

export function Login() {
  const signedIn = useAuthStore((state) => state.isAuthenticated)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let live = true
    void returnLeg
      .then((callback) => {
        if (!live) return
        if (callback.status === 'granted') {
          window.location.assign(localTarget(callback.redirect ?? callback.returnUrl))
          return
        }
        if (callback.status === 'error') setError(callback.errorDescription || callback.error)
        if (callback.status === 'failed') setError('Giriş tamamlanamadı. Yeniden deneyin.')
        setPending(false)
      })
      .catch((cause: unknown) => {
        if (!live) return
        setError(errorText(cause))
        setPending(false)
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    window.location.assign(localTarget(new URLSearchParams(window.location.search).get('redirect')))
  }, [signedIn])

  async function enter() {
    setPending(true)
    setError(null)
    try {
      const result = await session.signIn()
      if (result.status === 'granted' || result.status === 'authenticated') {
        window.location.assign(localTarget(result.returnUrl ?? new URLSearchParams(window.location.search).get('redirect')))
        return
      }
      if (result.status === 'error') setError(result.errorDescription || 'Giriş tamamlanamadı. Yeniden deneyin.')
      else if (result.status !== 'redirecting') setError('Giriş tamamlanamadı. Yeniden deneyin.')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-stone-500">Wyndbase</p>
        <h1 className="mt-3 font-serif text-5xl">Issue Tracker</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          Pano, sprint ve bildirimler. Giriş bu tabanın Wyndbase hesabıyla yapılır.
        </p>
        {error ? (
          <div className="mt-4">
            <Banner>{error}</Banner>
          </div>
        ) : null}
        <div className="mt-6">
          <Button onClick={() => void enter()} disabled={pending}>
            {pending ? 'Yönlendiriliyor…' : 'Giriş yap'}
          </Button>
        </div>
      </div>
    </main>
  )
}

export function useMe() {
  return useQuery(wyndbase.account.getMe())
}

export function useRoles() {
  const roles = useRead<{ roleName: string }>('desk.myRoles')
  const names = new Set((roles.data ?? []).map((row) => row.roleName))
  const has = (...wanted: string[]) => wanted.some((role) => names.has(role))
  return {
    ready: roles.isSuccess,
    names: [...names],
    label: [...names].map((role) => roleLabel[role] ?? role).join(' · ') || 'Rol yok',
    has,
    manage: has('yonetici', 'proje_yoneticisi'),
    write: has('yonetici', 'proje_yoneticisi', 'gelistirici', 'tester'),
    govern: has('yonetici'),
    seeInternal: has('yonetici', 'proje_yoneticisi', 'tester'),
  }
}

export function owns(me: Me | undefined, issue: { reporterId: string | null; assigneeId: string | null }) {
  if (!me) return false
  return issue.reporterId === me._id || issue.assigneeId === me._id
}
