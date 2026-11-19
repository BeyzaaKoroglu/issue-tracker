import { wyndbaseSDK } from '@wyndbase/sdk/core'
import { Inbox } from '@wyndbase/sdk/plugins/inbox'
import { browserSession } from '@wyndbase/sdk/session/browser'

export const loginPath = '/login'

export const session = browserSession({ autoRegister: true })

export const wyndbase = new wyndbaseSDK('wyndbase://tracker-app@dev.wyndbase.dev/tracker', {
  session,
  onUnauthorized: () => {
    if (window.location.pathname.startsWith(loginPath)) return
    const next = window.location.pathname + window.location.search
    window.location.assign(`${loginPath}?redirect=${encodeURIComponent(next)}`)
  },
}).use(Inbox)

type Call = (params?: Record<string, unknown>) => Promise<unknown>

function call(tree: 'query' | 'mutation', name: string, params?: Record<string, unknown>) {
  const [space, query] = name.split('.')
  const branch = (wyndbase[tree] as unknown as Record<string, Record<string, Call>>)[space]
  return branch[query](params)
}

export function read<T>(name: string, params?: Record<string, unknown>) {
  return call('query', name, params) as Promise<T[]>
}

export function write<T>(name: string, params?: Record<string, unknown>) {
  return call('mutation', name, params) as Promise<T[]>
}

export function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return 'İşlem tamamlanamadı.'
}
