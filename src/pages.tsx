import { useEffect, useRef, useState } from 'react'
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
  type AuthTeam,
  type Issue,
  type IssueDetail,
  type Me,
  type Member,
  type MyTeam,
  type Project,
  type Release,
  type Requester,
  type SavedSearch,
  type Sprint,
  type TeamMembership,
  type TeamRow,
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

export function Board({ go, initialProjectId = '' }: { go: (path: string) => void; initialProjectId?: string }) {
  const issues = useRead<Issue>('desk.listIssues')
  const projects = useRead<Project>('desk.listProjects')
  const teams = useRead<MyTeam>('desk.listMyTeams')
  const saved = useRead<SavedSearch>('desk.listMySearches')
  const roles = useRoles()
  const me = useMeId()
  const refresh = useRefresh()
  const [projectId, setProjectId] = useState(initialProjectId)
  useEffect(() => setProjectId(initialProjectId), [initialProjectId])
  const [status, setStatus] = useState('')
  const [term, setTerm] = useState('')
  const [mine, setMine] = useState(false)
  const [bookmark, setBookmark] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const skipClick = useRef(false)
  const myTeams = new Set((teams.data ?? []).map((row) => row.teamId))
  const allProjects = projects.data ?? []
  const dragged = (issues.data ?? []).find((row) => row._id === dragId) ?? null

  function onTeam(issue: Issue) {
    const teamId = (projects.data ?? []).find((item) => item._id === issue.projectId)?.teamId
    return !!teamId && myTeams.has(teamId)
  }

  function canMove(issue: Issue, to: string) {
    if (issue.status === to || !onTeam(issue)) return false
    const ownWork = roles.has('gelistirici') && !roles.manage && !roles.has('tester')
    if (ownWork && !owns(me, issue)) return false
    return (moves[issue.status] ?? []).some((move) => move.to === to && roles.has(...move.roles))
  }

  const rows = (issues.data ?? []).filter((row) => {
    if (projectId && row.projectId !== projectId) return false
    if (status && row.status !== status) return false
    if (mine && row.assigneeId !== me?._id) return false
    const needle = term.trim().toLocaleLowerCase('tr')
    if (!needle) return true
    const haystack = `${row.projectKey}-${row.number} ${row.title}`.toLocaleLowerCase('tr')
    return haystack.includes(needle)
  })

  return (
    <Page title="Pano" lede="Herkes issue açar ve atar. Durumu yalnızca projenin takımı değiştirir.">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Field label="Arama">
            <TextInput value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Başlık veya anahtar" />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Proje">
            <Select
              value={projectId}
              onChange={(event) => {
                const next = event.target.value
                setProjectId(next)
                window.history.replaceState(null, '', next ? `/?proje=${encodeURIComponent(next)}` : '/')
              }}
            >
              <option value="">Tümü</option>
              {(projects.data ?? []).map((row) => (
                <option key={row._id} value={row._id}>
                  {row.key}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-44">
          <Field label="Durum">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tümü</option>
              {columns.map((value) => (
                <option key={value} value={value}>{statusLabel[value]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />
          Bana atananlar
        </label>
        {allProjects.length > 0 ? (
          <Button tone="ghost" onClick={() => setOpen((value) => !value)}>
            Yeni issue
          </Button>
        ) : null}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput className="max-w-56" value={bookmark} onChange={(event) => setBookmark(event.target.value)} placeholder="Arama adı" />
        <Button
          tone="ghost"
          disabled={!bookmark.trim()}
          onClick={() =>
            void write('desk.saveSearch', {
              name: bookmark.trim(),
              term: blank(term),
              status: blank(status),
              onlyMine: mine,
              projectId: blank(projectId),
            })
              .then(() => refresh('desk.listMySearches'))
              .then(() => setBookmark(''))
              .catch((cause: unknown) => setError(errorText(cause)))
          }
        >
          Aramayı kaydet
        </Button>
        {(saved.data ?? []).map((row) => (
          <span key={row._id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-sm">
            <button
              onClick={() => {
                setTerm(row.term ?? '')
                setStatus(row.status ?? '')
                setMine(row.onlyMine)
                setProjectId(row.projectId ?? '')
              }}
            >
              {row.name}
            </button>
            <button
              className="text-stone-400"
              onClick={() => void write('desk.deleteSearch', { id: row._id }).then(() => refresh('desk.listMySearches'))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {error ? (
        <div className="mb-4">
          <Banner>{error}</Banner>
        </div>
      ) : null}
      {open && allProjects.length > 0 ? (
        <NewIssue
          projects={allProjects}
          onDone={async () => {
            setOpen(false)
            await refresh('desk.listIssues', 'desk.listProjects')
          }}
          onError={setError}
        />
      ) : null}
      {issues.isError ? <Banner>{errorText(issues.error)}</Banner> : null}
      <div className="grid gap-3 lg:grid-cols-5">
        {columns.map((column) => {
          const list = rows.filter((row) => row.status === column)
          const accepts = dragged ? canMove(dragged, column) : false
          return (
            <div
              key={column}
              onDragOver={(event) => {
                if (!accepts) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOver(column)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const id = event.dataTransfer.getData('text/plain')
                const issue = (issues.data ?? []).find((row) => row._id === id)
                setDragId(null)
                setOver(null)
                if (!issue || !canMove(issue, column)) return
                void write('desk.moveIssue', { id, status: column })
                  .then(() => refresh('desk.listIssues'))
                  .catch((cause: unknown) => setError(errorText(cause)))
              }}
              className={`rounded-2xl p-2 ${accepts && over === column ? 'bg-stone-300/80 ring-2 ring-stone-500' : 'bg-stone-200/50'}`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{statusLabel[column]}</p>
                <p className="text-xs text-stone-500">{list.length}</p>
              </div>
              <div className="min-h-24 space-y-2">
                {list.map((row) => {
                  const movable = columns.some((target) => canMove(row, target))
                  return (
                    <button
                      key={row._id}
                      draggable={movable}
                      onDragStart={(event) => {
                        skipClick.current = true
                        event.dataTransfer.setData('text/plain', row._id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDragId(row._id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOver(null)
                        setTimeout(() => {
                          skipClick.current = false
                        }, 0)
                      }}
                      onClick={() => {
                        if (skipClick.current) return
                        go(`/issue/${row._id}`)
                      }}
                      className={`block w-full rounded-xl bg-white p-3 text-left shadow-sm ${movable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === row._id ? 'opacity-40' : ''}`}
                    >
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
                  )
                })}
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
  onDone,
  onError,
}: {
  projects: Project[]
  onDone: () => Promise<void>
  onError: (message: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?._id ?? '')
  const members = useRead<Member>('desk.listProjectMembers', { projectId }, !!projectId)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    onError('')
    try {
      const text = String(data.get('body') ?? '').trim()
      await write('desk.createIssue', {
        projectId,
        title: data.get('title'),
        kind: data.get('kind'),
        priority: data.get('priority'),
        assigneeId: blank(String(data.get('assignee') ?? '')),
        dueOn: blank(String(data.get('dueOn') ?? '')),
        body: text ? { body: text, attachments: [] } : null,
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
          <Select name="projectId" required value={projectId} onChange={(event) => setProjectId(event.target.value)}>
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
            {(members.data ?? []).map((row) => (
              <option key={row.userId} value={row.userId}>
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
  const projects = useRead<Project>('desk.listProjects')
  const mine = useRead<MyTeam>('desk.listMyTeams')
  const sprints = useRead<Sprint>('desk.listSprints')
  const releases = useRead<Release>('desk.listReleases')
  const requesters = useRead<Requester>('desk.listRequesters')
  const roles = useRoles()
  const me = useMeId()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const row = issue.data?.[0]
  const projectTeam = (projects.data ?? []).find((item) => item._id === row?.projectId)?.teamId
  const onTeam = !!projectTeam && (mine.data ?? []).some((item) => item.teamId === projectTeam)
  const canEdit = !!row && onTeam && roles.write && (roles.manage || roles.has('tester') || (roles.has('gelistirici') && owns(me, row)))
  const allowed = row && onTeam ? (moves[row.status] ?? []).filter((move) => roles.has(...move.roles)) : []

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
            {row.projectKey}-{row.number} · {row.projectName} · {row.kindLabel}
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
              projects={(projects.data ?? []).filter(
                (item) => item._id === row.projectId || (!!item.teamId && (mine.data ?? []).some((team) => team.teamId === item.teamId)),
              )}
              sprints={sprints.data ?? []}
              releases={releases.data ?? []}
              requesters={requesters.data ?? []}
              onSave={(params) =>
                act(async () => {
                  const { description, ...rest } = params
                  await write('desk.updateIssue', rest)
                  await write('desk.updateIssueBody', { id: row._id, body: { body: String(description ?? ''), attachments: [] } })
                }, ['desk.getIssue', 'desk.listIssues'])
              }
            />
          ) : null}
          <Comments
            rows={(comments.data ?? []).filter((item) => roles.seeInternal || !item.internal)}
            canWrite={onTeam && roles.write}
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
            canWrite={onTeam && roles.write}
            onAdd={(minutes, spentOn, text) =>
              act(() => write('desk.logWork', { issueId: id, minutes, spentOn, note: text }), ['desk.listWorklogs'])
            }
          />
        </div>
        <div className="space-y-4">
          <Card className="space-y-2 p-4 text-sm">
            <p>
              <span className="text-stone-500">Proje: </span>
              <button className="underline" onClick={() => go(`/?proje=${row.projectId ?? ''}`)}>
                {row.projectKey} · {row.projectName ?? '—'}
              </button>
            </p>
            <Line k="Raporlayan" v={row.reporterName} />
            <Line k="Atanan" v={row.assigneeName} />
            {!canEdit && row.projectId ? (
              <AssignBox
                projectId={row.projectId}
                assigneeId={row.assigneeId}
                onSave={(assigneeId) =>
                  act(() => write('desk.assignIssue', { id: row._id, assigneeId }), ['desk.getIssue', 'desk.listIssues', 'desk.listActivity'])
                }
              />
            ) : null}
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

function AssignBox({
  projectId,
  assigneeId,
  onSave,
}: {
  projectId: string
  assigneeId: string | null
  onSave: (assigneeId: string | null) => Promise<void>
}) {
  const members = useRead<Member>('desk.listProjectMembers', { projectId }, !!projectId)
  const [value, setValue] = useState(assigneeId ?? '')
  const [pending, setPending] = useState(false)
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <Field label="Atama">
        <Select value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">Yok</option>
          {(members.data ?? []).map((member) => (
            <option key={member.userId} value={member.userId}>{member.name ?? member.username}</option>
          ))}
        </Select>
      </Field>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true)
          void onSave(blank(value)).finally(() => setPending(false))
        }}
      >
        {pending ? 'Kaydediliyor…' : 'Ata'}
      </Button>
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
  projects,
  sprints,
  releases,
  requesters,
  onSave,
}: {
  row: IssueDetail
  projects: Project[]
  sprints: Sprint[]
  releases: Release[]
  requesters: Requester[]
  onSave: (params: Record<string, unknown>) => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [projectId, setProjectId] = useState(row.projectId ?? '')
  const [assigneeId, setAssigneeId] = useState(row.assigneeId ?? '')
  const [sprintId, setSprintId] = useState(row.sprintId ?? '')
  const [releaseId, setReleaseId] = useState(row.releaseId ?? '')
  const members = useRead<Member>('desk.listProjectMembers', { projectId }, !!projectId)
  const moving = projectId !== (row.projectId ?? '')
  useEffect(() => {
    if (!members.isSuccess || !assigneeId) return
    if (!(members.data ?? []).some((member) => member.userId === assigneeId)) setAssigneeId('')
  }, [assigneeId, members.data, members.isSuccess])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    const points = blank(String(data.get('storyPoints') ?? ''))
    const hours = blank(String(data.get('estimateHours') ?? ''))
    await onSave({
      id: row._id,
      projectId,
      title: data.get('title'),
      priority: data.get('priority'),
      kind: data.get('kind'),
      assigneeId: blank(assigneeId),
      sprintId: moving ? null : blank(sprintId),
      requesterId: blank(String(data.get('requester') ?? '')),
      releaseId: moving ? null : blank(releaseId),
      dueOn: blank(String(data.get('dueOn') ?? '')),
      storyPoints: points ? Number(points) : null,
      estimateHours: hours ? Number(hours) : null,
      environment: blank(String(data.get('environment') ?? '')),
      blocked: data.get('blocked') === 'on',
      description: String(data.get('body') ?? ''),
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
        <Field label="Proje">
          <Select
            value={projectId}
            onChange={(event) => {
              const next = event.target.value
              setProjectId(next)
              if (next !== row.projectId) {
                setSprintId('')
                setReleaseId('')
              }
            }}
          >
            {projects.map((item) => (
              <option key={item._id} value={item._id}>
                {item.key} · {item.name}
              </option>
            ))}
          </Select>
        </Field>
        {moving ? (
          <p className="text-xs leading-5 text-stone-500 md:col-span-2">
            Proje değişince numara yenilenir. Sprint ve yayın boşalır. Atanan kişi yeni projenin takımında olmalıdır.
          </p>
        ) : null}
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
          <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Yok</option>
            {(members.data ?? []).map((member) => (
              <option key={member.userId} value={member.userId}>{member.name ?? member.username}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sprint">
          <Select value={sprintId} onChange={(event) => setSprintId(event.target.value)} disabled={moving}>
            <option value="">Yok</option>
            {sprints.filter((sprint) => sprint.projectId === projectId).map((sprint) => (
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
          <Select value={releaseId} onChange={(event) => setReleaseId(event.target.value)} disabled={moving}>
            <option value="">Yok</option>
            {releases.filter((release) => release.projectId === projectId).map((release) => (
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

export function Projects({ go }: { go: (path: string) => void }) {
  const projects = useRead<Project>('desk.listProjects')
  const issues = useRead<Issue>('desk.listIssues')
  const users = useRead<UserRow>('desk.listUsers')
  const teams = useRead<TeamRow>('desk.listTeams')
  const roles = useRoles()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  return (
    <Page title="Projeler" lede="Bir projenin issue'ları burada listelenir. Panoda aynı proje seçilerek süzülür.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(projects.data ?? []).map((row) => {
          const list = (issues.data ?? []).filter((issue) => issue.projectId === row._id)
          return (
            <Card key={row._id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">{row.key}</p>
                  <h2 className="font-serif text-2xl">{row.name}</h2>
                </div>
                <Button tone="ghost" onClick={() => go(`/?proje=${row._id}`)}>Panoda aç</Button>
              </div>
              <p className="mt-2 text-sm text-stone-500">
                {row.openCount} açık · lider {row.leadName ?? '—'} · {row.teamName ?? 'takım yok'}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {row.language ?? '—'} · standup {row.standupAt?.slice(0, 5) ?? '—'} · {row.startsOn ?? '—'}
              </p>
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {list.length === 0 ? <li className="text-sm text-stone-500">Issue yok.</li> : null}
                {list.map((issue) => (
                  <li key={issue._id}>
                    <button className="text-left text-sm underline" onClick={() => go(`/issue/${issue._id}`)}>
                      {issue.projectKey}-{issue.number} · {issue.title}
                    </button>
                    <span className="ml-2 text-xs text-stone-500">{statusLabel[issue.status] ?? issue.status}</span>
                  </li>
                ))}
              </ul>
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
            void write('desk.createProject', {
              key: String(data.get('key') ?? '').trim().toUpperCase(),
              name: data.get('name'),
              leadId: data.get('lead'),
              teamId: data.get('team'),
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
          <Field label="Takım">
            <Select name="team" required>
              {(teams.data ?? []).map((team) => (
                <option key={team._id} value={team._id}>{team.name}</option>
              ))}
            </Select>
          </Field>
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

export function Teams() {
  const teams = useRead<AuthTeam>('auth.listTeams')
  const users = useRead<UserRow>('desk.listUsers')
  const mine = useRead<MyTeam>('desk.listMyTeams')
  const roles = useRoles()
  const refresh = useRefresh()
  const [teamId, setTeamId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rows = teams.data ?? []
  const selected = teamId || rows[0]?._id || ''
  const memberships = useRead<TeamMembership>('auth.listTeamMemberships', { teamId: selected }, !!selected)
  const leadTeams = new Set((mine.data ?? []).filter((row) => row.kind === 'lead').map((row) => row.teamId))
  const canRoster = roles.govern || leadTeams.has(selected)
  const projects = useRead<Project>('desk.listProjects')
  const names = new Map(rows.map((row) => [row._id, row.name]))
  const current = rows.find((row) => row._id === selected)
  const taken = new Set((memberships.data ?? []).map((row) => row.userId))

  function reload() {
    return refresh('auth.listTeams', 'auth.listTeamMemberships', 'desk.listTeams', 'desk.listMyTeams', 'desk.listProjects')
  }

  return (
    <Page title="Takımlar" lede="Yönetici takımı açar, adlandırır ve lider atar. Takım lideri üye ekler ve çıkarır.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      {teams.isError ? <Banner>{errorText(teams.error)}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              key={row._id}
              onClick={() => setTeamId(row._id)}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${row._id === selected ? 'bg-ink text-white' : 'bg-white'}`}
            >
              <span className="block font-medium">{row.name}</span>
              <span className={`block text-xs ${row._id === selected ? 'text-stone-300' : 'text-stone-500'}`}>
                {row.parent ? names.get(row.parent) ?? 'Üst takım' : 'Kök takım'}
              </span>
            </button>
          ))}
          {rows.length === 0 ? <p className="text-sm text-stone-500">Takım yok.</p> : null}
        </div>
        {current ? (
          <Card className="space-y-4 p-4">
            <div>
              <h2 className="font-serif text-3xl">{current.name}</h2>
              <p className="text-sm text-stone-500">{current.parent ? `Üst takım: ${names.get(current.parent)}` : 'Kök takım'}</p>
            </div>
            {roles.govern ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
                  if (!name) return
                  void write('auth.renameTeam', { teamId: current._id, name })
                    .then(() => reload())
                    .catch((cause: unknown) => setError(errorText(cause)))
                }}
              >
                <Field label="Ad">
                  <TextInput name="name" key={current._id} defaultValue={current.name} required />
                </Field>
                <Button type="submit" tone="ghost">Adı kaydet</Button>
              </form>
            ) : null}
            <ul className="space-y-2">
              {(memberships.data ?? []).map((row) => (
                <li key={row._id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {row.name ?? row.username} · {row.kind === 'lead' ? 'Lider' : 'Üye'}
                  </span>
                  <span className="flex gap-2">
                    {roles.govern ? (
                      <Button
                        tone="ghost"
                        onClick={() =>
                          void write('desk.setTeamMemberKind', { membershipId: row._id, kind: row.kind === 'lead' ? 'member' : 'lead' })
                            .then(() => reload())
                            .catch((cause: unknown) => setError(errorText(cause)))
                        }
                      >
                        {row.kind === 'lead' ? 'Üye yap' : 'Lider yap'}
                      </Button>
                    ) : null}
                    {canRoster && (roles.govern || row.kind !== 'lead') ? (
                      <Button
                        tone="danger"
                        onClick={() =>
                          void write('auth.removeTeamMember', { membershipId: row._id })
                            .then(() => reload())
                            .catch((cause: unknown) => setError(errorText(cause)))
                        }
                      >
                        Çıkar
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
              {(memberships.data ?? []).length === 0 ? <li className="text-sm text-stone-500">Üye yok.</li> : null}
            </ul>
            {canRoster ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  const userId = String(data.get('user') ?? '')
                  const kind = String(data.get('kind') ?? 'member')
                  const action = kind === 'lead'
                    ? write('desk.addTeamLead', { teamId: current._id, userId })
                    : write('auth.addTeamMembers', { teamId: current._id, kind: 'member', users: [{ userId }] })
                  void action
                    .then(() => reload())
                    .then(() => event.currentTarget.reset())
                    .catch((cause: unknown) => setError(errorText(cause)))
                }}
              >
                <Field label="Üye">
                  <Select name="user" required>
                    <option value="">Seç</option>
                    {(users.data ?? []).filter((user) => !taken.has(user._id)).map((user) => (
                      <option key={user._id} value={user._id}>{user.name ?? user.username}</option>
                    ))}
                  </Select>
                </Field>
                {roles.govern ? (
                  <Field label="Tür">
                    <Select name="kind" defaultValue="member">
                      <option value="member">Üye</option>
                      <option value="lead">Lider</option>
                    </Select>
                  </Field>
                ) : null}
                <Button type="submit">Ekle</Button>
              </form>
            ) : (
              <p className="text-sm text-stone-500">Bu kadroyu yalnızca takımın lideri veya yönetici değiştirir.</p>
            )}
            {roles.govern ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const parent = blank(String(new FormData(event.currentTarget).get('parent') ?? ''))
                    void write('auth.moveTeam', { teamId: current._id, parent })
                      .then(() => reload())
                      .catch((cause: unknown) => setError(errorText(cause)))
                  }}
                >
                  <Field label="Üst takım">
                    <Select name="parent" key={current.parent ?? 'root'} defaultValue={current.parent ?? ''}>
                      <option value="">Kök</option>
                      {rows.filter((row) => row._id !== current._id).map((row) => (
                        <option key={row._id} value={row._id}>{row.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" tone="ghost">Taşı</Button>
                </form>
                {(projects.data ?? []).some((item) => item.teamId === current._id) ? (
                  <p className="self-end text-xs text-stone-500">Bu takıma bağlı proje varken silinmez.</p>
                ) : (
                  <Button
                    tone="danger"
                    onClick={() =>
                      void write('auth.deleteTeam', { teamId: current._id })
                        .then(() => {
                          setTeamId('')
                          return reload()
                        })
                        .catch((cause: unknown) => setError(errorText(cause)))
                    }
                  >
                    Takımı sil
                  </Button>
                )}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
      {roles.govern ? (
        <form
          className="mt-6 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const data = new FormData(form)
            void write('auth.addTeam', {
              name: String(data.get('name') ?? '').trim(),
              parent: blank(String(data.get('parent') ?? '')),
              leadScope: 'team',
              managedBy: 'local',
            })
              .then(() => reload())
              .then(() => form.reset())
              .catch((cause: unknown) => setError(errorText(cause)))
          }}
        >
          <h2 className="font-medium">Yeni takım</h2>
          <Field label="Ad"><TextInput name="name" required /></Field>
          <Field label="Üst takım">
            <Select name="parent">
              <option value="">Kök</option>
              {rows.map((row) => (
                <option key={row._id} value={row._id}>{row.name}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Takımı aç</Button>
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
