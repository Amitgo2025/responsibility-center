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
