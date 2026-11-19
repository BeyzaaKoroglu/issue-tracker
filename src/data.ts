import { useQuery, useQueryClient } from '@tanstack/react-query'
import { read } from './wyndbase'

export function useRead<T>(name: string, params?: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: params ? [name, params] : [name],
    queryFn: () => read<T>(name, params),
    enabled,
  })
}

export function useRefresh() {
  const client = useQueryClient()
  return (...names: string[]) => Promise.all(names.map((name) => client.invalidateQueries({ queryKey: [name] })))
}

export function note(body: { body?: string | null } | string | null | undefined) {
  if (!body) return ''
  if (typeof body === 'string') return body
  return body.body ?? ''
}
