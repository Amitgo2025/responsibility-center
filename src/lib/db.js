import { db } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { defaultTabs, defaultResponsibilities, defaultTagCategories, defaultTags } from '../data/seed'

// ============== ID HELPERS ==============
export function newId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// ============== TABS (people) ==============
export async function listTabs() {
  const snap = await getDocs(collection(db, 'tabs'))
  const tabs = []
  snap.forEach((d) => tabs.push({ id: d.id, ...d.data() }))
  tabs.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  return tabs
}

export async function getTab(tabId) {
  const ref = doc(db, 'tabs', tabId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function saveTab(tabId, data) {
  await setDoc(
    doc(db, 'tabs', tabId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function deleteTab(tabId) {
  // Delete the tab AND all its responsibilities
  const respSnap = await getDocs(query(collection(db, 'responsibilities'), where('personId', '==', tabId)))
  const deletions = []
  respSnap.forEach((d) => deletions.push(deleteDoc(doc(db, 'responsibilities', d.id))))
  await Promise.all(deletions)
  await deleteDoc(doc(db, 'tabs', tabId))
}

// ============== RESPONSIBILITIES ==============
export async function listResponsibilities(opts = {}) {
  // opts: { personId, section }
  let q = collection(db, 'responsibilities')
  const constraints = []
  if (opts.personId) constraints.push(where('personId', '==', opts.personId))
  if (opts.section) constraints.push(where('section', '==', opts.section))
  if (constraints.length) q = query(q, ...constraints)
  const snap = await getDocs(q)
  const items = []
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }))
  items.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  return items
}

export async function listAllResponsibilities() {
  const snap = await getDocs(collection(db, 'responsibilities'))
  const items = []
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }))
  return items
}

export async function createResponsibility(data, currentUser) {
  const now = new Date().toISOString()
  // Find max sortOrder for this person+section so we append
  const existing = await listResponsibilities({
    personId: data.personId,
    section: data.section,
  })
  const maxOrder = existing.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), -1)

  const payload = {
    personId: data.personId,
    section: data.section, // 'media' | 'other'
    title: data.title || '',
    description: data.description || '',
    status: data.status || 'active',
    tags: data.tags || [], // array of tag IDs
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser?.displayName || 'admin',
  }
  const ref = await addDoc(collection(db, 'responsibilities'), payload)
  return { id: ref.id, ...payload }
}

export async function updateResponsibility(id, patch) {
  await updateDoc(doc(db, 'responsibilities', id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteResponsibility(id) {
  await deleteDoc(doc(db, 'responsibilities', id))
}

export async function reorderResponsibility(id, currentList, direction) {
  const idx = currentList.findIndex((r) => r.id === id)
  if (idx < 0) return
  const target = idx + direction
  if (target < 0 || target >= currentList.length) return
  const a = currentList[idx]
  const b = currentList[target]
  await Promise.all([
    updateDoc(doc(db, 'responsibilities', a.id), { sortOrder: b.sortOrder ?? target }),
    updateDoc(doc(db, 'responsibilities', b.id), { sortOrder: a.sortOrder ?? idx }),
  ])
}

// ============== TAG CATEGORIES ==============
export async function listTagCategories() {
  const snap = await getDocs(collection(db, 'tagCategories'))
  const cats = []
  snap.forEach((d) => cats.push({ id: d.id, ...d.data() }))
  cats.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  return cats
}

export async function createTagCategory(data) {
  const cats = await listTagCategories()
  const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), -1)
  const payload = {
    name: data.name,
    sortOrder: maxOrder + 1,
    createdAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, 'tagCategories'), payload)
  return { id: ref.id, ...payload }
}

export async function updateTagCategory(id, patch) {
  await updateDoc(doc(db, 'tagCategories', id), patch)
}

export async function deleteTagCategory(id) {
  // Also delete any tags in this category
  const tagSnap = await getDocs(query(collection(db, 'tags'), where('categoryId', '==', id)))
  const deletions = []
  const removedTagIds = []
  tagSnap.forEach((d) => {
    deletions.push(deleteDoc(doc(db, 'tags', d.id)))
    removedTagIds.push(d.id)
  })
  await Promise.all(deletions)
  await deleteDoc(doc(db, 'tagCategories', id))
  // Strip any references to these tags from responsibilities
  if (removedTagIds.length) {
    const respSnap = await getDocs(collection(db, 'responsibilities'))
    const updates = []
    respSnap.forEach((d) => {
      const data = d.data()
      const filtered = (data.tags || []).filter((t) => !removedTagIds.includes(t))
      if (filtered.length !== (data.tags || []).length) {
        updates.push(updateDoc(doc(db, 'responsibilities', d.id), { tags: filtered }))
      }
    })
    await Promise.all(updates)
  }
}

// ============== TAGS ==============
export async function listTags() {
  const snap = await getDocs(collection(db, 'tags'))
  const tags = []
  snap.forEach((d) => tags.push({ id: d.id, ...d.data() }))
  return tags
}

export async function createTag(data) {
  const payload = {
    categoryId: data.categoryId,
    name: data.name,
    color: data.color || '#c46a3a',
    createdAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, 'tags'), payload)
  return { id: ref.id, ...payload }
}

export async function updateTag(id, patch) {
  await updateDoc(doc(db, 'tags', id), patch)
}

export async function deleteTag(id) {
  await deleteDoc(doc(db, 'tags', id))
  // Strip this tag from any responsibility
  const respSnap = await getDocs(collection(db, 'responsibilities'))
  const updates = []
  respSnap.forEach((d) => {
    const data = d.data()
    if ((data.tags || []).includes(id)) {
      updates.push(
        updateDoc(doc(db, 'responsibilities', d.id), {
          tags: data.tags.filter((t) => t !== id),
        }),
      )
    }
  })
  await Promise.all(updates)
}

// ============== NOTES / REQUESTS ==============
export async function listAllNotes() {
  const snap = await getDocs(collection(db, 'notes'))
  const notes = []
  snap.forEach((d) => notes.push({ id: d.id, ...d.data() }))
  notes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return notes
}

export async function listNotesForResponsibility(respId) {
  const q = query(collection(db, 'notes'), where('responsibilityId', '==', respId))
  const snap = await getDocs(q)
  const notes = []
  snap.forEach((d) => notes.push({ id: d.id, ...d.data() }))
  notes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return notes
}

export async function createNote(data, currentUser) {
  const now = new Date().toISOString()
  const payload = {
    responsibilityId: data.responsibilityId,
    personId: data.personId, // person who owns the responsibility
    title: data.title || '',
    body: data.body || '',
    tags: data.tags || [],
    attachments: data.attachments || [], // [{ name, dataUrl, type }]
    status: 'open', // 'open' | 'closed'
    createdAt: now,
    updatedAt: now,
    author: currentUser?.displayName || (currentUser?.role === 'admin' ? 'Amit (admin)' : 'anonymous'),
    authorRole: currentUser?.role || 'viewer',
  }
  const ref = await addDoc(collection(db, 'notes'), payload)
  return { id: ref.id, ...payload }
}

export async function updateNoteStatus(id, status) {
  await updateDoc(doc(db, 'notes', id), {
    status,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteNote(id) {
  await deleteDoc(doc(db, 'notes', id))
}

// ============== SCHEDULE: TASK TEMPLATES ==============
// A scheduled task template is a recurring/one-off task definition.
// Cadence types:
//   - 'daily'      : every day
//   - 'weekly'     : on specific days of the week (daysOfWeek: [0..6], 0=Sunday)
//   - 'dates'      : on specific calendar dates (dates: ['YYYY-MM-DD', ...])
//   - 'custom'     : explicit per-date assignments (handled via assignments map)
// Assignments map: { 'YYYY-MM-DD': 'personId' } — which person owns that date.
// If no assignment exists for a generated date, it shows up as "unassigned".
//
// deadlineTime: 'HH:MM' string in Israel timezone (Asia/Jerusalem). Optional.
// When set, an instance becomes "missed" if not closed by deadline.

export async function listScheduleTasks() {
  const snap = await getDocs(collection(db, 'scheduleTasks'))
  const items = []
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }))
  items.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
  return items
}

export async function createScheduleTask(data) {
  const tasks = await listScheduleTasks()
  const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1)
  const payload = {
    name: data.name || '',
    description: data.description || '',
    cadence: data.cadence || 'daily', // 'daily' | 'weekly' | 'dates' | 'custom'
    daysOfWeek: data.daysOfWeek || [], // for 'weekly'
    dates: data.dates || [], // for 'dates'
    assignments: data.assignments || {}, // map of { 'YYYY-MM-DD': 'personId' }
    color: data.color || '#c46a3a',
    deadlineTime: data.deadlineTime || '', // 'HH:MM' Israel time, '' = no deadline
    active: data.active !== false,
    sortOrder: maxOrder + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, 'scheduleTasks'), payload)
  return { id: ref.id, ...payload }
}

export async function updateScheduleTask(id, patch) {
  await updateDoc(doc(db, 'scheduleTasks', id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
  // If deadlineTime changed, propagate to today's open instance for this template
  if ('deadlineTime' in patch) {
    const today = todayDateString()
    const snap = await getDocs(
      query(
        collection(db, 'taskInstances'),
        where('templateId', '==', id),
        where('date', '==', today),
      ),
    )
    const updates = []
    snap.forEach((d) => {
      const data = d.data()
      if (data.status === 'open') {
        const newDeadline = patch.deadlineTime
          ? computeDeadlineISOSimple(today, patch.deadlineTime)
          : null
        updates.push(
          updateDoc(doc(db, 'taskInstances', d.id), {
            deadline: newDeadline,
            deadlineTime: patch.deadlineTime || '',
          }),
        )
      }
    })
    await Promise.all(updates)
  }
}

export async function deleteScheduleTask(id) {
  // Also delete any task instances tied to this template
  const snap = await getDocs(query(collection(db, 'taskInstances'), where('templateId', '==', id)))
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'taskInstances', d.id))))
  await deleteDoc(doc(db, 'scheduleTasks', id))
}

// Bulk-set assignments for a template — used by the calendar UI
export async function setScheduleAssignments(taskId, assignments) {
  await updateDoc(doc(db, 'scheduleTasks', taskId), {
    assignments,
    updatedAt: new Date().toISOString(),
  })
}

// ============== SCHEDULE: TASK INSTANCES ==============
// Instances are concrete "this task on this date" records.
// They are created lazily when a date is reached (or on demand).
// Each has status: 'open' | 'closed' and a closure log.

export async function listTaskInstances(opts = {}) {
  // opts: { date, dateFrom, dateTo, status }
  let q = collection(db, 'taskInstances')
  const constraints = []
  if (opts.date) constraints.push(where('date', '==', opts.date))
  if (opts.status) constraints.push(where('status', '==', opts.status))
  if (constraints.length) q = query(q, ...constraints)
  const snap = await getDocs(q)
  const items = []
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }))
  // Filter date range client-side if needed
  if (opts.dateFrom || opts.dateTo) {
    return items.filter((i) => {
      if (opts.dateFrom && i.date < opts.dateFrom) return false
      if (opts.dateTo && i.date > opts.dateTo) return false
      return true
    })
  }
  return items
}

export async function createTaskInstance(data) {
  const payload = {
    templateId: data.templateId,
    name: data.name || '',
    date: data.date, // 'YYYY-MM-DD'
    personId: data.personId || '',
    color: data.color || '#c46a3a',
    deadline: data.deadline || null, // ISO string, computed from deadlineTime + date in Israel TZ
    deadlineTime: data.deadlineTime || '', // 'HH:MM' for display
    status: 'open',
    closedBy: null,
    closedAt: null,
    createdAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, 'taskInstances'), payload)
  return { id: ref.id, ...payload }
}

export async function closeTaskInstance(id, closer, device) {
  await updateDoc(doc(db, 'taskInstances', id), {
    status: 'closed',
    closedBy: closer || 'unknown',
    closedAt: new Date().toISOString(),
    closedDevice: device || '',
  })
}

// Detects the rough device type from the browser's user-agent string.
// Returns: 'Mobile' | 'Tablet' | 'Desktop'.
export function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'Desktop'
  const ua = navigator.userAgent || ''
  // iPad on iPadOS 13+ identifies as Macintosh with touch — catch it via touch points
  const iPadLike =
    /iPad/i.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1)
  if (iPadLike) return 'Tablet'
  if (/Tablet|PlayBook|Silk/i.test(ua)) return 'Tablet'
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'Tablet'
  if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile'
  return 'Desktop'
}

export async function reopenTaskInstance(id) {
  await updateDoc(doc(db, 'taskInstances', id), {
    status: 'open',
    closedBy: null,
    closedAt: null,
  })
}

export async function reassignTaskInstance(id, newPersonId) {
  await updateDoc(doc(db, 'taskInstances', id), {
    personId: newPersonId || '',
    reassignedAt: new Date().toISOString(),
  })
}

export async function deleteTaskInstance(id) {
  await deleteDoc(doc(db, 'taskInstances', id))
}

// Compute the effective status of an instance — including 'missed' if past deadline
// while still open. Returns: 'closed' | 'missed' | 'open' (open with deadline) | 'open'.
export function effectiveStatus(instance, now) {
  if (instance.status === 'closed') return 'closed'
  if (instance.deadline) {
    const deadlineDate = new Date(instance.deadline)
    if ((now || new Date()) > deadlineDate) return 'missed'
  }
  return 'open'
}

// Compute the deadline ISO string given a date 'YYYY-MM-DD' and time 'HH:MM' in Israel time.
// Israel is UTC+2 (winter) or UTC+3 (summer) — DST handled via Intl with Asia/Jerusalem.
export function computeDeadlineISO(dateStr, timeStr) {
  return computeDeadlineISOSimple(dateStr, timeStr)
}

// Robust deadline computation: find the UTC instant whose Asia/Jerusalem clock equals
// dateStr at HH:MM. Handles DST by iteratively correcting based on the wall clock the
// guess produces.
function computeDeadlineISOSimple(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [hh, mm] = timeStr.split(':').map((x) => parseInt(x, 10))
  if (isNaN(hh) || isNaN(mm)) return null
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10))
  // Initial guess: treat the wall clock as UTC, then adjust.
  let guess = Date.UTC(y, mo - 1, d, hh, mm, 0)
  for (let i = 0; i < 3; i++) {
    const wallInIsrael = new Date(guess).toLocaleString('en-CA', {
      timeZone: 'Asia/Jerusalem',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    const m = wallInIsrael.match(/(\d{4})-(\d{2})-(\d{2})[, ]+(\d{1,2}):(\d{2})/)
    if (!m) break
    const wY = parseInt(m[1], 10)
    const wMo = parseInt(m[2], 10)
    const wD = parseInt(m[3], 10)
    const wH = parseInt(m[4], 10)
    const wMi = parseInt(m[5], 10)
    const targetMins = (((y * 12) + mo) * 31 + d) * 24 * 60 + hh * 60 + mm
    const guessMins = (((wY * 12) + wMo) * 31 + wD) * 24 * 60 + wH * 60 + wMi
    const diff = (targetMins - guessMins) * 60 * 1000
    if (Math.abs(diff) < 1000) break
    guess += diff
  }
  return new Date(guess).toISOString()
}

// Format a Date as Israel local time string for display
export function formatIsraelTime(isoOrDate, opts = {}) {
  if (!isoOrDate) return ''
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  const showSeconds = opts.seconds === true
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
  })
}

// Make sure today's task instances exist — call once on app load.
// For each active template, if today should have an instance per its cadence,
// and no instance exists yet for (templateId, today's date), create one.
export async function ensureTodayInstances() {
  const today = todayDateString()
  const dayOfWeek = new Date(today + 'T00:00:00').getDay()

  const [templates, existing] = await Promise.all([
    listScheduleTasks(),
    listTaskInstances({ date: today }),
  ])
  const existingTplIds = new Set(existing.map((i) => i.templateId))

  const created = []
  for (const tpl of templates) {
    if (!tpl.active) continue
    if (existingTplIds.has(tpl.id)) continue
    if (!shouldRunOn(tpl, today, dayOfWeek)) continue
    const personId = tpl.assignments?.[today] || ''
    const deadline = tpl.deadlineTime
      ? computeDeadlineISOSimple(today, tpl.deadlineTime)
      : null
    const inst = await createTaskInstance({
      templateId: tpl.id,
      name: tpl.name,
      date: today,
      personId,
      color: tpl.color || '#c46a3a',
      deadline,
      deadlineTime: tpl.deadlineTime || '',
    })
    created.push(inst)
  }
  return { created }
}

export function shouldRunOn(template, dateStr, dayOfWeek) {
  if (template.cadence === 'daily') return true
  if (template.cadence === 'weekly') {
    return Array.isArray(template.daysOfWeek) && template.daysOfWeek.includes(dayOfWeek)
  }
  if (template.cadence === 'dates') {
    return Array.isArray(template.dates) && template.dates.includes(dateStr)
  }
  if (template.cadence === 'custom') {
    // For 'custom', a date counts if it has an explicit assignment
    return !!(template.assignments && template.assignments[dateStr])
  }
  return false
}

export function todayDateString() {
  // Returns 'YYYY-MM-DD' for the current date in Israel timezone
  const d = new Date()
  const parts = d.toLocaleString('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA gives 'YYYY-MM-DD'
  const m = parts.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // Fallback to local
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

// Generate the upcoming dates a template will run, between dateFrom and dateTo
export function generateScheduledDates(template, dateFrom, dateTo) {
  const result = []
  const start = new Date(dateFrom + 'T00:00:00')
  const end = new Date(dateTo + 'T00:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    if (shouldRunOn(template, dateStr, d.getDay())) {
      result.push(dateStr)
    }
  }
  return result
}

// ============== SEED ==============
export async function seedDefaultData() {
  const now = new Date().toISOString()

  // Check if any data already exists — only seed if empty
  const existingTabs = await listTabs()
  if (existingTabs.length > 0) {
    return { skipped: true, reason: 'Data already exists' }
  }

  // Seed tabs
  for (const tab of defaultTabs) {
    const { id, ...rest } = tab
    await setDoc(doc(db, 'tabs', id), { ...rest, createdAt: now, updatedAt: now })
  }

  // Seed tag categories — track ID mapping
  const categoryIdMap = {}
  for (const cat of defaultTagCategories) {
    const { tempId, ...rest } = cat
    const ref = await addDoc(collection(db, 'tagCategories'), { ...rest, createdAt: now })
    categoryIdMap[tempId] = ref.id
  }

  // Seed tags — translate tempCategoryId to real category ID
  const tagIdMap = {}
  for (const tag of defaultTags) {
    const { tempId, tempCategoryId, ...rest } = tag
    const ref = await addDoc(collection(db, 'tags'), {
      ...rest,
      categoryId: categoryIdMap[tempCategoryId],
      createdAt: now,
    })
    tagIdMap[tempId] = ref.id
  }

  // Seed responsibilities — translate tempTagIds to real tag IDs
  for (const resp of defaultResponsibilities) {
    const { tempTagIds, ...rest } = resp
    await addDoc(collection(db, 'responsibilities'), {
      ...rest,
      tags: (tempTagIds || []).map((t) => tagIdMap[t]).filter(Boolean),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    })
  }

  return { seeded: true }
}
