import { db } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { defaultData } from '../data/seed'

// Collection: tabs
//   doc id = tab slug (e.g. "amit", "dina", "shared")
//   data: { name, role, contributionShare, color, sortOrder, items: [{ id, title, notes, status }] }

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
  const ref = doc(db, 'tabs', tabId)
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function deleteTab(tabId) {
  await deleteDoc(doc(db, 'tabs', tabId))
}

// Generate a stable random id for items
export function newItemId() {
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// Seed default data — only writes tabs that don't already exist
export async function seedDefaultData() {
  const existing = await listTabs()
  const existingIds = new Set(existing.map((t) => t.id))
  let created = 0
  for (const tab of defaultData) {
    if (existingIds.has(tab.id)) continue
    const { id, ...rest } = tab
    await setDoc(doc(db, 'tabs', id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    created++
  }
  return { created, skipped: defaultData.length - created }
}
