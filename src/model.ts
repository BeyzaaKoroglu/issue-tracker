export const roleLabel: Record<string, string> = {
  yonetici: 'Yönetici',
  proje_yoneticisi: 'Proje yöneticisi',
  gelistirici: 'Geliştirici',
  tester: 'Testçi',
  izleyici: 'İzleyici',
}

export const statusLabel: Record<string, string> = {
  backlog: 'Beklemede',
  selected: 'Seçildi',
  in_progress: 'Yapılıyor',
  in_review: 'İncelemede',
  done: 'Bitti',
}

export const sprintLabel: Record<string, string> = {
  planned: 'Planlandı',
  active: 'Aktif',
  closed: 'Kapandı',
}

export const columns = ['backlog', 'selected', 'in_progress', 'in_review', 'done'] as const

export const kinds = [
  ['epic', 'Epik'],
  ['story', 'Hikaye'],
  ['task', 'Görev'],
  ['bug', 'Hata'],
] as const

export const priorities = [
  ['critical', 'Kritik'],
  ['high', 'Yüksek'],
  ['medium', 'Orta'],
  ['low', 'Düşük'],
] as const

export const moves: Record<string, { to: string; label: string; roles: string[] }[]> = {
  backlog: [
    { to: 'selected', label: 'Seç', roles: ['gelistirici', 'tester', 'proje_yoneticisi', 'yonetici'] },
    { to: 'in_progress', label: 'Hemen başlat', roles: ['proje_yoneticisi', 'yonetici'] },
  ],
  selected: [
    { to: 'backlog', label: 'Geri al', roles: ['proje_yoneticisi', 'yonetici'] },
    { to: 'in_progress', label: 'Başlat', roles: ['gelistirici', 'proje_yoneticisi', 'yonetici'] },
  ],
  in_progress: [{ to: 'in_review', label: 'İncelemeye gönder', roles: ['gelistirici', 'proje_yoneticisi', 'yonetici'] }],
  in_review: [
    { to: 'in_progress', label: 'Geri yolla', roles: ['gelistirici', 'tester', 'proje_yoneticisi', 'yonetici'] },
    { to: 'done', label: 'Bitir', roles: ['tester', 'proje_yoneticisi', 'yonetici'] },
  ],
  done: [{ to: 'in_progress', label: 'Yeniden aç', roles: ['tester', 'proje_yoneticisi', 'yonetici'] }],
}

export const sprintMoves: Record<string, { to: string; label: string; roles: string[] }[]> = {
  planned: [{ to: 'active', label: 'Başlat', roles: ['proje_yoneticisi', 'yonetici'] }],
  active: [{ to: 'closed', label: 'Kapat', roles: ['proje_yoneticisi', 'yonetici'] }],
  closed: [{ to: 'planned', label: 'Yeniden planla', roles: ['yonetici'] }],
}

export type Issue = {
  _id: string
  number: number
  title: string
  kind: string
  kindLabel: string | null
  priority: string
  priorityLabel: string | null
  status: string
  blocked: boolean
  dueOn: string | null
  storyPoints: number | null
  rank: number | null
  projectId: string | null
  projectKey: string | null
  projectName: string | null
  sprintId: string | null
  sprintName: string | null
  reporterId: string | null
  reporterName: string | null
  assigneeId: string | null
  assigneeName: string | null
}

export type IssueDetail = Issue & {
  body: { body?: string | null } | null
  environment: string | null
  estimateHours: string | null
  requesterId: string | null
  requesterName: string | null
  requesterEmail: string | null
  requesterPhone: string | null
  releaseId: string | null
  releaseName: string | null
  parentId: string | null
  labelNames: string[] | null
  watcherNames: string[] | null
}

export type Project = {
  _id: string
  key: string
  name: string
  status: string
  site: string | null
  startsOn: string | null
  language: string | null
  standupAt: string | null
  leadId: string | null
  leadName: string | null
  teamId: string | null
  teamName: string | null
  openCount: number
}

export type UserRow = { _id: string; username: string; name: string | null }
export type TeamRow = { _id: string; name: string }
export type AuthTeam = {
  _id: string
  name: string
  parent: string | null
  leadScope: string | null
  managedBy: string | null
}
export type TeamMembership = {
  _id: string
  kind: string | null
  userId: string | null
  username: string | null
  name: string | null
}
export type MyTeam = { _id: string; teamId: string; teamName: string; kind: string }
export type Member = { _id: string; userId: string; username: string; name: string | null; kind: string }
export type SavedSearch = {
  _id: string
  name: string
  description: string | null
  query: string
  state: string | null
}
export type Sprint = {
  _id: string
  name: string
  goal: string | null
  startsOn: string | null
  endsOn: string | null
  state: string
  projectId: string | null
  projectKey: string | null
}
export type Requester = {
  _id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  country: string | null
}
export type Comment = {
  _id: string
  body: { body?: string | null } | string | null
  authorId: string | null
  authorName: string | null
  parentId: string | null
  resolvedAt: string | null
  resolverName: string | null
  _createdAt: string
}
export type Worklog = { _id: string; minutes: number; note: string | null; spentOn: string | null; authorName: string | null }
export type IssueVersion = {
  _versionId: string
  _startAt: string
  _endAt: string | null
  title: string | null
  status: string | null
  editor: string | null
}
export type Release = { _id: string; name: string; shipMonth: string | null; shipped: boolean; projectId: string | null; projectKey: string | null }
export type Sla = { _id: string; priority: string; priorityLabel: string | null; responseHours: number }
export type Me = { _id: string; username: string; name: string | null }

export function blank(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function priorityTone(priority: string) {
  if (priority === 'critical') return 'rose'
  if (priority === 'high') return 'amber'
  if (priority === 'medium') return 'sky'
  return 'stone'
}
