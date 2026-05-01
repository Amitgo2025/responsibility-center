import { db } from './firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const SESSION_KEY = 'rc_session'
const ROLE_KEY = 'rc_role'
const NAME_KEY = 'rc_name'

async function hash(text) {
  const data = new TextEncoder().encode(text)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function getAuthConfig() {
  const ref = doc(db, 'config', 'auth')
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data()
}

export async function initializeAuth(viewerPassword, adminPassword) {
  const ref = doc(db, 'config', 'auth')
  const existing = await getDoc(ref)
  if (existing.exists()) {
    throw new Error('System is already initialized.')
  }
  if (!viewerPassword || viewerPassword.length < 4) {
    throw new Error('Viewer password must be at least 4 characters')
  }
  if (!adminPassword || adminPassword.length < 6) {
    throw new Error('Admin password must be at least 6 characters')
  }
  if (viewerPassword === adminPassword) {
    throw new Error('Viewer and admin passwords must be different')
  }
  const viewerHash = await hash(viewerPassword)
  const adminHash = await hash(adminPassword)
  await setDoc(ref, {
    viewerHash,
    adminHash,
    initializedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function tryLogin(password) {
  const config = await getAuthConfig()
  if (!config) return null
  const h = await hash(password)
  if (h === config.adminHash) {
    sessionStorage.setItem(SESSION_KEY, '1')
    sessionStorage.setItem(ROLE_KEY, 'admin')
    return 'admin'
  }
  if (h === config.viewerHash) {
    sessionStorage.setItem(SESSION_KEY, '1')
    sessionStorage.setItem(ROLE_KEY, 'viewer')
    return 'viewer'
  }
  return null
}

export function setDisplayName(name) {
  if (name && name.trim()) {
    sessionStorage.setItem(NAME_KEY, name.trim())
  }
}

export function getSession() {
  const has = sessionStorage.getItem(SESSION_KEY) === '1'
  if (!has) return null
  return {
    role: sessionStorage.getItem(ROLE_KEY) || 'viewer',
    displayName: sessionStorage.getItem(NAME_KEY) || '',
  }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(ROLE_KEY)
  sessionStorage.removeItem(NAME_KEY)
}

export async function changePasswords({ currentAdminPassword, newViewerPassword, newAdminPassword }) {
  const config = await getAuthConfig()
  if (!config) throw new Error('System not initialized')
  const currentHash = await hash(currentAdminPassword)
  if (currentHash !== config.adminHash) {
    throw new Error('Current admin password is incorrect')
  }
  const update = { updatedAt: serverTimestamp() }
  if (newViewerPassword) {
    if (newViewerPassword.length < 4) throw new Error('Viewer password must be at least 4 characters')
    update.viewerHash = await hash(newViewerPassword)
  }
  if (newAdminPassword) {
    if (newAdminPassword.length < 6) throw new Error('Admin password must be at least 6 characters')
    update.adminHash = await hash(newAdminPassword)
  }
  const finalViewerHash = update.viewerHash || config.viewerHash
  const finalAdminHash = update.adminHash || config.adminHash
  if (finalViewerHash === finalAdminHash) {
    throw new Error('Viewer and admin passwords must be different')
  }
  await setDoc(doc(db, 'config', 'auth'), update, { merge: true })
}
