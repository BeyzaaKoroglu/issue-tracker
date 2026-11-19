import { useState } from 'react'
import { note, useRead, useRefresh } from './data'
import {
  blank,
  columns,
  kinds,
  moves,
  priorities,
  priorityTone,
  sprintLabel,
  sprintMoves,
  statusLabel,
  type Activity,
  type Comment,
  type Issue,
  type IssueDetail,
  type Me,
  type Project,
  type Release,
  type Requester,
  type Sprint,
  type UserRow,
  type Worklog,
} from './model'
import { owns, useMe, useRoles } from './session'
import { errorText, write } from './wyndbase'
import { Area, Banner, Button, Card, Empty, Field, Page, Pill, Select, TextInput } from './ui'

function useMeId() {
  const me = useMe()
  return me.data as Me | undefined
}

export function Board({ go }: { go: (path: string) => void }) {
  const issues = useRead<Issue>('desk.listIssues')
  const projects = useRead<Project>('desk.listProjects')
  const users = useRead<UserRow>('desk.listUsers')
  const roles = useRoles()
  const me = useMeId()
  const refresh = useRefresh()
  const [projectId, setProjectId] = useState('')
  const [mine, setMine] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = (issues.data ?? []).filter((row) => {
    if (projectId && row.projectId !== projectId) return false
    if (mine && row.assigneeId !== me?._id) return false
    return true
  })

  return (
    <Page title="Pano" lede="Issue'lar duruma göre. Kritik ve geciken işler Kerem'in uyarılarında da durur.">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Field label="Proje">
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Tümü</option>
              {(projects.data ?? []).map((row) => (
                <option key={row._id} value={row._id}>
                  {row.key}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />
          Bana atananlar
        </label>
        {roles.write ? (
          <Button tone="ghost" onClick={() => setOpen((value) => !value)}>
            Yeni issue
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="mb-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      {open && roles.write ? (
        <NewIssue
          projects={projects.data ?? []}
          users={users.data ?? []}
          onDone={async () => {
            setOpen(false)
            await refresh('desk.listIssues', 'desk.listProjects')
          }}
          onError={setError}
        />
      ) : null}
      {issues.isError ? <Banner>{errorText(issues.error)}</Banner> : null}
      <div className="grid gap-3 lg:grid-cols-5">
        {columns.map((status) => {
          const list = rows.filter((row) => row.status === status)
          return (
            <div key={status} className="rounded-2xl bg-stone-200/50 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{statusLabel[status]}</p>
                <p className="text-xs text-stone-500">{list.length}</p>
              </div>
              <div className="space-y-2">
                {list.map((row) => (
                  <button key={row._id} onClick={() => go(`/issue/${row._id}`)} className="block w-full rounded-xl bg-white p-3 text-left shadow-sm">
                    <p className="text-xs text-stone-500">
                      {row.projectKey}-{row.number}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5">{row.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Pill tone={priorityTone(row.priority)}>{row.priorityLabel ?? row.priority}</Pill>
                      {row.blocked ? <Pill tone="rose">Bloke</Pill> : null}
                      {row.dueOn ? <Pill>{row.dueOn}</Pill> : null}
                    </div>
                    <p className="mt-2 text-xs text-stone-500">{row.assigneeName ?? 'Atanmamış'}</p>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Page>
  )
}

function NewIssue({
  projects,
  users,
  onDone,
  onError,
}: {
  projects: Project[]
  users: UserRow[]
  onDone: () => Promise<void>
  onError: (message: string) => void
}) {
  const [pending, setPending] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    onError('')
    try {
      const body = String(data.get('body') ?? '').trim()
      await write('desk.createIssue', {
        projectId: data.get('projectId'),
        title: data.get('title'),
        kind: data.get('kind'),
        priority: data.get('priority'),
        assigneeId: blank(String(data.get('assignee') ?? '')),
        dueOn: blank(String(data.get('dueOn') ?? '')),
        body: body ? { body, attachments: [] } : null,
      })
      await onDone()
    } catch (cause) {
      onError(errorText(cause))
    } finally {
      setPending(false)
    }
  }
  return (
    <Card className="mb-4 p-4">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <Field label="Proje">
          <Select name="projectId" required defaultValue={projects[0]?._id}>
            {projects.map((row) => (
              <option key={row._id} value={row._id}>
                {row.key} · {row.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Başlık">
          <TextInput name="title" required />
        </Field>
        <Field label="Tür">
          <Select name="kind" defaultValue="task">
            {kinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öncelik">
          <Select name="priority" defaultValue="medium">
            {priorities.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Atanan">
          <Select name="assignee" defaultValue="">
            <option value="">Sonra</option>
            {users.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name ?? row.username}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Termin">
          <TextInput name="dueOn" type="date" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Açıklama">
            <Area name="body" />
          </Field>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Açılıyor…' : 'Issue aç'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function IssuePage({ id, go }: { id: string; go: (path: string) => void }) {
  const issue = useRead<IssueDetail>('desk.getIssue', { id })
  const comments = useRead<Comment>('desk.listComments', { issueId: id })
  const work = useRead<Worklog>('desk.listWorklogs', { issueId: id })
  const activity = useRead<Activity>('desk.listActivity', { issueId: id })
  const users = useRead<UserRow>('desk.listUsers')
  const sprints = useRead<Sprint>('desk.listSprints')
  const releases = useRead<Release>('desk.listReleases')
  const requesters = useRead<Requester>('desk.listRequesters')
  const roles = useRoles()
  const me = useMeId()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const row = issue.data?.[0]
  const canEdit = !!row && roles.write && (roles.manage || roles.has('tester') || (roles.has('gelistirici') && owns(me, row)))
  const allowed = row ? (moves[row.status] ?? []).filter((move) => roles.has(...move.roles)) : []

  async function act(action: () => Promise<unknown>, names: string[]) {
    setError(null)
    try {
      await action()
      await refresh(...names)
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  if (issue.isError) return <Banner>{errorText(issue.error)}</Banner>
  if (!row) return <p className="text-sm text-stone-500">{issue.isLoading ? 'Yükleniyor…' : 'Issue yok.'}</p>

  return (
    <div>
      <button className="mb-3 text-sm text-stone-500 underline" onClick={() => go('/')}>
        Panoya dön
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">
            {row.projectKey}-{row.number} · {row.kindLabel}
          </p>
          <h1 className="mt-1 font-serif text-4xl">{row.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone={priorityTone(row.priority)}>{row.priorityLabel}</Pill>
            <Pill tone={row.status === 'done' ? 'green' : 'sky'}>{statusLabel[row.status] ?? row.status}</Pill>
            {row.blocked ? <Pill tone="rose">Bloke</Pill> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowed.map((move) => (
            <Button
              key={move.to}
              tone="ghost"
              onClick={() => void act(() => write('desk.moveIssue', { id, status: move.to }), ['desk.getIssue', 'desk.listIssues', 'desk.listActivity'])}
            >
              {move.label}
            </Button>
          ))}
        </div>
      </div>
      {error ? (
        <div className="mt-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-6">{note(row.body) || 'Açıklama yok.'}</p>
            {row.environment ? <p className="mt-3 text-xs text-stone-500">Ortam: {row.environment}</p> : null}
          </Card>
          {canEdit ? (
            <EditIssue
              row={row}
              users={users.data ?? []}
              sprints={(sprints.data ?? []).filter((sprint) => sprint.projectId === row.projectId)}
              releases={(releases.data ?? []).filter((release) => release.projectId === row.projectId)}
              requesters={requesters.data ?? []}
              onSave={(params) => act(() => write('desk.updateIssue', params), ['desk.getIssue', 'desk.listIssues'])}
            />
          ) : null}
          <Comments
            rows={(comments.data ?? []).filter((item) => roles.seeInternal || !item.internal)}
            canWrite={roles.write}
            canInternal={roles.seeInternal}
            onAdd={(body, internal) =>
              act(
                () => write('desk.createComment', { issueId: id, body: { body, attachments: [] }, internal }),
                ['desk.listComments'],
              )
            }
          />
          <Work
            rows={work.data ?? []}
            canWrite={roles.write}
            onAdd={(minutes, spentOn, text) =>
              act(() => write('desk.logWork', { issueId: id, minutes, spentOn, note: text }), ['desk.listWorklogs'])
            }
          />
        </div>
        <div className="space-y-4">
          <Card className="space-y-2 p-4 text-sm">
            <Line k="Raporlayan" v={row.reporterName} />
            <Line k="Atanan" v={row.assigneeName} />
            <Line k="Sprint" v={row.sprintName} />
            <Line k="Talep sahibi" v={row.requesterName} />
            <Line k="E-posta" v={row.requesterEmail} />
            <Line k="Telefon" v={row.requesterPhone} />
            <Line k="Yayın" v={row.releaseName} />
            <Line k="Termin" v={row.dueOn} />
            <Line k="Puan" v={row.storyPoints} />
            <Line k="Tahmin" v={row.estimateHours ? `${row.estimateHours} sa` : null} />
            <Line k="Etiket" v={(row.labelNames ?? []).join(', ')} />
            <Line k="İzleyen" v={(row.watcherNames ?? []).join(', ')} />
          </Card>
          {canEdit && row.assigneeId ? (
            <Button
              tone="ghost"
              onClick={() =>
                void act(
                  () =>
                    write('desk.notifyIssue', {
                      recipientId: row.assigneeId,
                      title: `${row.projectKey}-${row.number} sana atandı`,
                      body: row.title,
                      issueId: row._id,
                    }),
                  [],
                )
              }
            >
              Atanana mektup ve bildirim
            </Button>
          ) : null}
          <Card>
            <h2 className="px-4 pt-4 text-sm font-medium">Hareket</h2>
            {(activity.data ?? []).length === 0 ? (
              <Empty>Kayıt yok.</Empty>
            ) : (
              <ul className="space-y-2 px-4 py-3 text-sm">
                {(activity.data ?? []).map((item) => (
                  <li key={item._id}>
                    <span className="text-stone-500">{(item.at ?? item._createdAt ?? '').slice(0, 16).replace('T', ' ')}</span> {item.event} · {item.summary}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Line({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <p>
      <span className="text-stone-500">{k}: </span>
      {v || '—'}
    </p>
  )
}

function EditIssue({
  row,
  users,
  sprints,
  releases,
  requesters,
  onSave,
}: {
  row: IssueDetail
  users: UserRow[]
  sprints: Sprint[]
  releases: Release[]
  requesters: Requester[]
  onSave: (params: Record<string, unknown>) => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    const points = blank(String(data.get('storyPoints') ?? ''))
    const hours = blank(String(data.get('estimateHours') ?? ''))
    await onSave({
      id: row._id,
      title: data.get('title'),
      priority: data.get('priority'),
      kind: data.get('kind'),
      assigneeId: blank(String(data.get('assignee') ?? '')),
      sprintId: blank(String(data.get('sprint') ?? '')),
      requesterId: blank(String(data.get('requester') ?? '')),
      releaseId: blank(String(data.get('fixRelease') ?? '')),
      dueOn: blank(String(data.get('dueOn') ?? '')),
      storyPoints: points ? Number(points) : null,
      estimateHours: hours ? Number(hours) : null,
      environment: blank(String(data.get('environment') ?? '')),
      blocked: data.get('blocked') === 'on',
      body: { body: String(data.get('body') ?? ''), attachments: [] },
    })
    setPending(false)
  }
  return (
    <Card className="p-4">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <div className="md:col-span-2">
          <Field label="Başlık">
            <TextInput name="title" defaultValue={row.title} required />
          </Field>
        </div>
        <Field label="Öncelik">
          <Select name="priority" defaultValue={row.priority}>
            {priorities.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tür">
          <Select name="kind" defaultValue={row.kind}>
            {kinds.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Atanan">
          <Select name="assignee" defaultValue={row.assigneeId ?? ''}>
            <option value="">Yok</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>{user.name ?? user.username}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sprint">
          <Select name="sprint" defaultValue={row.sprintId ?? ''}>
            <option value="">Yok</option>
            {sprints.map((sprint) => (
              <option key={sprint._id} value={sprint._id}>{sprint.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Talep sahibi">
          <Select name="requester" defaultValue={row.requesterId ?? ''}>
            <option value="">Yok</option>
            {requesters.map((person) => (
              <option key={person._id} value={person._id}>{person.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Yayın">
          <Select name="fixRelease" defaultValue={row.releaseId ?? ''}>
            <option value="">Yok</option>
            {releases.map((release) => (
              <option key={release._id} value={release._id}>{release.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Termin">
          <TextInput name="dueOn" type="date" defaultValue={row.dueOn ?? ''} />
        </Field>
        <Field label="Puan">
          <TextInput name="storyPoints" type="number" min={0} defaultValue={row.storyPoints ?? ''} />
        </Field>
        <Field label="Tahmin (saat)">
          <TextInput name="estimateHours" type="number" step="0.5" min={0} defaultValue={row.estimateHours ?? ''} />
        </Field>
        <Field label="Ortam">
          <TextInput name="environment" defaultValue={row.environment ?? ''} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input name="blocked" type="checkbox" defaultChecked={row.blocked} /> Bloke
        </label>
        <div className="md:col-span-2">
          <Field label="Açıklama">
            <Area name="body" defaultValue={note(row.body)} />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </form>
    </Card>
  )
}

function Comments({
  rows,
  canWrite,
  canInternal,
  onAdd,
}: {
  rows: Comment[]
  canWrite: boolean
  canInternal: boolean
  onAdd: (body: string, internal: boolean) => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  return (
    <Card>
      <h2 className="px-4 pt-4 text-sm font-medium">Yorumlar</h2>
      {rows.length === 0 ? <Empty>Yorum yok.</Empty> : (
        <ul className="space-y-3 px-4 py-3">
          {rows.map((row) => (
            <li key={row._id} className="text-sm">
              <p className="text-xs text-stone-500">
                {row.authorName} · {row._createdAt.slice(0, 16).replace('T', ' ')}
                {row.internal ? ' · iç not' : ''}
              </p>
              <p className="whitespace-pre-wrap">{note(row.body)}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form
          className="space-y-2 border-t border-line p-4"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const text = String(data.get('body') ?? '').trim()
            if (!text) return
            setPending(true)
            void onAdd(text, data.get('internal') === 'on').finally(() => {
              setPending(false)
              event.currentTarget.reset()
            })
          }}
        >
          <Area name="body" placeholder="Yorum" required />
          {canInternal ? (
            <label className="flex items-center gap-2 text-sm">
              <input name="internal" type="checkbox" /> İç not
            </label>
          ) : null}
          <Button type="submit" disabled={pending}>Yorum yaz</Button>
        </form>
      ) : null}
    </Card>
  )
}

function Work({
  rows,
  canWrite,
  onAdd,
}: {
  rows: Worklog[]
  canWrite: boolean
  onAdd: (minutes: number, spentOn: string, note: string | null) => Promise<void>
}) {
  return (
    <Card>
      <h2 className="px-4 pt-4 text-sm font-medium">Süre</h2>
      {rows.length === 0 ? <Empty>Kayıt yok.</Empty> : (
        <ul className="space-y-2 px-4 py-3 text-sm">
          {rows.map((row) => (
            <li key={row._id}>{row.minutes} dk · {row.spentOn} · {row.authorName} · {row.note}</li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form
          className="grid gap-2 border-t border-line p-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void onAdd(Number(data.get('minutes')), String(data.get('spentOn')), blank(String(data.get('note') ?? '')))
            event.currentTarget.reset()
          }}
        >
          <TextInput name="minutes" type="number" min={1} placeholder="Dakika" required />
          <TextInput name="spentOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          <TextInput name="note" placeholder="Not" />
          <Button type="submit">Süre yaz</Button>
        </form>
      ) : null}
    </Card>
  )
}

export function Projects() {
  const projects = useRead<Project>('desk.listProjects')
  const users = useRead<UserRow>('desk.listUsers')
  const roles = useRoles()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  return (
    <Page title="Projeler" lede="Anahtar bir kez yazılır. Açık issue sayısı, bitmemiş işlerden gelir.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(projects.data ?? []).map((row) => (
          <Card key={row._id} className="p-4">
            <p className="text-xs text-stone-500">{row.key}</p>
            <h2 className="font-serif text-2xl">{row.name}</h2>
            <p className="mt-2 text-sm text-stone-500">
              {row.openCount} açık · lider {row.leadName ?? '—'} · {row.teamName ?? 'takım yok'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {row.language ?? '—'} · standup {row.standupAt?.slice(0, 5) ?? '—'} · {row.startsOn ?? '—'}
            </p>
          </Card>
        ))}
      </div>
      {roles.manage ? (
        <form
          className="mt-6 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void write('desk.createProject', {
              key: String(data.get('key') ?? '').trim().toUpperCase(),
              name: data.get('name'),
              leadId: data.get('lead'),
              site: blank(String(data.get('site') ?? '')),
              startsOn: blank(String(data.get('startsOn') ?? '')),
              language: blank(String(data.get('language') ?? '')),
              standupAt: blank(String(data.get('standupAt') ?? '')),
            })
              .then(() => refresh('desk.listProjects'))
              .then(() => event.currentTarget.reset())
              .catch((cause: unknown) => setError(errorText(cause)))
          }}
        >
          <h2 className="font-medium">Yeni proje</h2>
          <Field label="Anahtar"><TextInput name="key" required maxLength={8} /></Field>
          <Field label="Ad"><TextInput name="name" required /></Field>
          <Field label="Lider">
            <Select name="lead" required>
              {(users.data ?? []).map((user) => (
                <option key={user._id} value={user._id}>{user.name ?? user.username}</option>
              ))}
            </Select>
          </Field>
          <Field label="Site"><TextInput name="site" type="url" placeholder="https://" /></Field>
          <Field label="Başlangıç"><TextInput name="startsOn" type="date" /></Field>
          <Field label="Dil"><TextInput name="language" placeholder="tr" /></Field>
          <Field label="Standup"><TextInput name="standupAt" type="time" /></Field>
          <Button type="submit">Projeyi aç</Button>
        </form>
      ) : null}
    </Page>
  )
}

export function Sprints() {
  const sprints = useRead<Sprint>('desk.listSprints')
  const projects = useRead<Project>('desk.listProjects')
  const roles = useRoles()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  return (
    <Page title="Sprintler" lede="Planlandı, aktif, kapandı. Geçişi rol belirler.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <div className="space-y-3">
        {(sprints.data ?? []).map((row) => {
          const allowed = (sprintMoves[row.state] ?? []).filter((move) => roles.has(...move.roles))
          return (
            <Card key={row._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-stone-500">{row.projectKey} · {row.startsOn} → {row.endsOn}</p>
                <h2 className="font-medium">{row.name}</h2>
                <p className="text-sm text-stone-500">{row.goal}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={row.state === 'active' ? 'green' : 'stone'}>{sprintLabel[row.state] ?? row.state}</Pill>
                {allowed.map((move) => (
                  <Button
                    key={move.to}
                    tone="ghost"
                    onClick={() =>
                      void write('desk.moveSprint', { id: row._id, state: move.to })
                        .then(() => refresh('desk.listSprints'))
                        .catch((cause: unknown) => setError(errorText(cause)))
                    }
                  >
                    {move.label}
                  </Button>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
      {roles.manage ? (
        <form
          className="mt-6 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void write('desk.createSprint', {
              projectId: data.get('projectId'),
              name: data.get('name'),
              goal: blank(String(data.get('goal') ?? '')),
              startsOn: data.get('startsOn'),
              endsOn: data.get('endsOn'),
            })
              .then(() => refresh('desk.listSprints'))
              .then(() => event.currentTarget.reset())
              .catch((cause: unknown) => setError(errorText(cause)))
          }}
        >
          <h2 className="font-medium">Yeni sprint</h2>
          <Field label="Proje">
            <Select name="projectId">{(projects.data ?? []).map((row) => <option key={row._id} value={row._id}>{row.key}</option>)}</Select>
          </Field>
          <Field label="Ad"><TextInput name="name" required /></Field>
          <Field label="Hedef"><TextInput name="goal" /></Field>
          <Field label="Başlangıç"><TextInput name="startsOn" type="date" required /></Field>
          <Field label="Bitiş"><TextInput name="endsOn" type="date" required /></Field>
          <Button type="submit">Sprint aç</Button>
        </form>
      ) : null}
    </Page>
  )
}

export function Requesters() {
  const people = useRead<Requester>('desk.listRequesters')
  const roles = useRoles()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  return (
    <Page title="Talep sahipleri" lede="Uygulamanın dışındaki kişiler. Telefon ve ülke kendi kolon tipindedir.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(people.data ?? []).map((row) => (
          <Card key={row._id} className="p-4 text-sm">
            <h2 className="font-medium">{row.name}</h2>
            <p className="text-stone-500">{row.company ?? 'Şirket yok'} · {row.country ?? '—'}</p>
            <p className="mt-1">{row.email ?? '—'}</p>
            <p>{row.phone ?? '—'}</p>
          </Card>
        ))}
      </div>
      {roles.write ? (
        <form
          className="mt-6 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void write('desk.createRequester', {
              name: data.get('name'),
              email: blank(String(data.get('email') ?? '')),
              phone: blank(String(data.get('phone') ?? '')),
              company: blank(String(data.get('company') ?? '')),
              country: blank(String(data.get('country') ?? '')),
            })
              .then(() => refresh('desk.listRequesters'))
              .then(() => event.currentTarget.reset())
              .catch((cause: unknown) => setError(errorText(cause)))
          }}
        >
          <h2 className="font-medium">Yeni talep sahibi</h2>
          <Field label="Ad"><TextInput name="name" required /></Field>
          <Field label="E-posta"><TextInput name="email" type="email" /></Field>
          <Field label="Telefon"><TextInput name="phone" placeholder="+90555…" /></Field>
          <Field label="Şirket"><TextInput name="company" /></Field>
          <Field label="Ülke"><TextInput name="country" placeholder="TR" maxLength={2} /></Field>
          <Button type="submit">Kaydet</Button>
        </form>
      ) : null}
    </Page>
  )
}

export function People() {
  const roles = useRoles()
  const users = useRead<UserRow>('desk.listUsers')
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  if (!roles.govern) return <Page title="Ekip" lede="Üye açmak yönetici rolüne bağlı." />
  return (
    <Page title="Ekip" lede="Yeni üye hesap açılış mektubu alır. Rol ayrıca verilir.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <ul className="space-y-2">
        {(users.data ?? []).map((user) => (
          <li key={user._id} className="text-sm">{user.name ?? user.username} · {user.username}</li>
        ))}
      </ul>
      <form
        className="mt-6 grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          setPending(true)
          setError(null)
          void write<{ _id: string }>('auth.createAccount', {
            username: data.get('username'),
            email: data.get('email'),
            name: data.get('name'),
            givenName: data.get('givenName'),
            familyName: data.get('familyName'),
          })
            .then((rows) => write('desk.assignRole', { userId: rows[0]._id, role: data.get('role') }))
            .then(() => refresh('desk.listUsers'))
            .then(() => form.reset())
            .catch((cause: unknown) => setError(errorText(cause)))
            .finally(() => setPending(false))
        }}
      >
        <h2 className="font-medium">Üye aç</h2>
        <Field label="Kullanıcı adı"><TextInput name="username" required /></Field>
        <Field label="Ad"><TextInput name="givenName" required /></Field>
        <Field label="Soyad"><TextInput name="familyName" required /></Field>
        <Field label="Görünen ad"><TextInput name="name" required /></Field>
        <Field label="E-posta"><TextInput name="email" type="email" required /></Field>
        <Field label="Rol">
          <Select name="role" defaultValue="gelistirici">
            <option value="yonetici">Yönetici</option>
            <option value="proje_yoneticisi">Proje yöneticisi</option>
            <option value="gelistirici">Geliştirici</option>
            <option value="tester">Testçi</option>
            <option value="izleyici">İzleyici</option>
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>{pending ? 'Açılıyor…' : 'Hesabı aç'}</Button>
      </form>
    </Page>
  )
}
