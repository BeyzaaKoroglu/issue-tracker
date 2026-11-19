import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorText, write, wyndbase } from './wyndbase'
import { Banner, Button, Card, Empty, Page } from './ui'

export function InboxPage() {
  const inbox = useQuery(wyndbase.inbox.unread.options())
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState('accept')
  const items = [
    ...(inbox.data?.list.assignments ?? []),
    ...(inbox.data?.list.notifications ?? []),
    ...(inbox.data?.list.alerts ?? []),
    ...(inbox.data?.list.mentions ?? []),
  ]
  const waiting = inbox.data?.list.interactions ?? []

  return (
    <Page title="Gelen" lede="Atamalar, anmalar, uyarılar ve onay bekleyen kritik issue'lar.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      {waiting.length > 0 ? (
        <div className="mb-4 space-y-3">
          {waiting.map((item) => (
            <Card key={item.id} className="space-y-3 p-4">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-stone-500">{item.description}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select className="rounded-xl border border-line px-3 py-2 text-sm" value={decision} onChange={(event) => setDecision(event.target.value)}>
                  <option value="accept">Kabul</option>
                  <option value="defer">Ertele</option>
                </select>
                <Button
                  onClick={() => {
                    const interactionId = item.target?.kind === 'interaction' ? item.target.interactionId : item.id
                    void write('system.answerInteraction', { interactionId, response: { decision } })
                      .then(() => inbox.refetch())
                      .catch((cause: unknown) => setError(errorText(cause)))
                  }}
                >
                  Kararı gönder
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      <Card>
        {items.length === 0 ? <Empty>Okunmamış kayıt yok.</Empty> : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-stone-500">{item.description ?? item.channelId}</p>
                <p className="text-xs text-stone-400">{item.occurredAt.slice(0, 16).replace('T', ' ')}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="mt-4">
        <Button tone="ghost" onClick={() => void wyndbase.inbox.markAllSeen().then(() => inbox.refetch())}>
          Hepsini okundu say
        </Button>
      </div>
    </Page>
  )
}
