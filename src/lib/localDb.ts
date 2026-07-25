// Local Machine Storage & Auth Engine
// Completely offline, local machine persistent storage replacing Firebase Cloud Firestore and Auth

export interface LocalUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  providerData?: any[];
  tenantId?: string | null;
}

const STORAGE_KEY = 'guesthouse_local_db';
const AUTH_USERS_KEY = 'guesthouse_local_auth_users';
const AUTH_SESSION_KEY = 'guesthouse_local_auth_session';

// Subscriptions for real-time reactivity
type Callback = () => void;
const listeners = new Set<Callback>();

function notifyListeners() {
  listeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error('Listener callback error:', e);
    }
  });
}

// Global window event listener for cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === AUTH_SESSION_KEY || e.key === AUTH_USERS_KEY) {
      notifyListeners();
      notifyAuthListeners();
    }
  });
  window.addEventListener('local-db-change', () => {
    notifyListeners();
  });
}

// Get store
export function getLocalStore(): Record<string, Record<string, any>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local db:', e);
  }
  return {};
}

// Save store
export function saveLocalStore(store: Record<string, Record<string, any>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('local-db-change'));
    }
  } catch (e) {
    console.error('Error saving local db:', e);
  }
}

// Bootstrap default local data if empty
(function initDefaultData() {
  const store = getLocalStore();
  let updated = false;

  if (!store.settings) store.settings = {};
  if (!store.settings.general) {
    store.settings.general = {
      id: 'general',
      companyName: 'My Guesthouse',
      address: '',
      phone: '',
      email: '',
      country: 'South Africa',
      currency: 'R',
      taxRate: 0,
      theme: 'luxury',
      backupFrequency: 'none'
    };
    updated = true;
  }

  if (!store.users) store.users = {};

  if (updated) {
    saveLocalStore(store);
  }
})();

// Document Reference
export class LocalDocRef {
  colName: string;
  id: string;

  constructor(colName: string, id: string) {
    this.colName = colName;
    this.id = id;
  }

  get path(): string {
    return `${this.colName}/${this.id}`;
  }
}

// Collection Reference
export class LocalCollectionRef {
  colName: string;

  constructor(colName: string) {
    this.colName = colName;
  }
}

// Query Constraint types
export interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  limitCount?: number;
}

export class LocalQuery {
  colRef: LocalCollectionRef;
  constraints: QueryConstraint[];

  constructor(colRef: LocalCollectionRef, constraints: QueryConstraint[] = []) {
    this.colRef = colRef;
    this.constraints = constraints;
  }
}

// Helper to construct path
export function doc(dbOrCol: any, ...pathSegments: string[]): LocalDocRef {
  if (dbOrCol instanceof LocalCollectionRef) {
    return new LocalDocRef(dbOrCol.colName, pathSegments[0]);
  }
  if (pathSegments.length === 1 && pathSegments[0].includes('/')) {
    const parts = pathSegments[0].split('/');
    return new LocalDocRef(parts[0], parts[1]);
  }
  if (pathSegments.length >= 2) {
    return new LocalDocRef(pathSegments[0], pathSegments[1]);
  }
  return new LocalDocRef('default', pathSegments[0] || 'doc');
}

export function collection(db: any, ...pathSegments: string[]): LocalCollectionRef {
  const fullPath = pathSegments.join('/');
  return new LocalCollectionRef(fullPath);
}

// Query constraints creators
export function where(field: string, op: string, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(limitCount: number): QueryConstraint {
  return { type: 'limit', limitCount };
}

export function query(colRef: LocalCollectionRef | LocalQuery, ...constraints: QueryConstraint[]): LocalQuery {
  const baseColRef = colRef instanceof LocalQuery ? colRef.colRef : colRef;
  const existingConstraints = colRef instanceof LocalQuery ? colRef.constraints : [];
  return new LocalQuery(baseColRef, [...existingConstraints, ...constraints]);
}

// Snapshot Document object wrapper
class LocalDocumentSnapshot {
  id: string;
  private _data: any;

  constructor(id: string, data: any) {
    this.id = id;
    this._data = data;
  }

  exists(): boolean {
    return this._data !== undefined && this._data !== null;
  }

  data(): any {
    return this._data ? { ...this._data } : undefined;
  }

  get ref(): LocalDocRef {
    return new LocalDocRef('unknown', this.id);
  }
}

class LocalQuerySnapshot {
  docs: LocalDocumentSnapshot[];

  constructor(docs: LocalDocumentSnapshot[]) {
    this.docs = docs;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(callback: (doc: LocalDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

// CRUD Operations
export async function getDoc(docRef: LocalDocRef): Promise<LocalDocumentSnapshot> {
  const store = getLocalStore();
  const col = store[docRef.colName] || {};
  const data = col[docRef.id];
  return new LocalDocumentSnapshot(docRef.id, data);
}

export async function getDocs(queryOrCol: LocalCollectionRef | LocalQuery): Promise<LocalQuerySnapshot> {
  const localQuery = queryOrCol instanceof LocalQuery ? queryOrCol : new LocalQuery(queryOrCol);
  const colName = localQuery.colRef.colName;
  const store = getLocalStore();
  const rawCol = store[colName] || {};

  let items = Object.entries(rawCol).map(([id, data]) => ({ id, ...data }));

  // Apply constraints
  for (const c of localQuery.constraints) {
    if (c.type === 'where' && c.field && c.op) {
      items = items.filter(item => {
        const val = item[c.field!];
        switch (c.op) {
          case '==': return val === c.value;
          case '!=': return val !== c.value;
          case 'in': return Array.isArray(c.value) && c.value.includes(val);
          case 'array-contains': return Array.isArray(val) && val.includes(c.value);
          case '<': return val < c.value;
          case '<=': return val <= c.value;
          case '>': return val > c.value;
          case '>=': return val >= c.value;
          default: return true;
        }
      });
    } else if (c.type === 'orderBy' && c.field) {
      const dir = c.direction === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        const valA = a[c.field!] ?? '';
        const valB = b[c.field!] ?? '';
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    } else if (c.type === 'limit' && c.limitCount) {
      items = items.slice(0, c.limitCount);
    }
  }

  const docSnapshots = items.map(item => new LocalDocumentSnapshot(item.id, item));
  return new LocalQuerySnapshot(docSnapshots);
}

export async function setDoc(docRef: LocalDocRef, data: any, options?: { merge?: boolean }): Promise<void> {
  const store = getLocalStore();
  if (!store[docRef.colName]) store[docRef.colName] = {};

  if (options?.merge && store[docRef.colName][docRef.id]) {
    store[docRef.colName][docRef.id] = {
      ...store[docRef.colName][docRef.id],
      ...data,
      id: docRef.id
    };
  } else {
    store[docRef.colName][docRef.id] = {
      ...data,
      id: docRef.id
    };
  }

  saveLocalStore(store);
}

export async function updateDoc(docRef: LocalDocRef, data: any): Promise<void> {
  return setDoc(docRef, data, { merge: true });
}

export async function addDoc(colRef: LocalCollectionRef, data: any): Promise<LocalDocRef> {
  const store = getLocalStore();
  if (!store[colRef.colName]) store[colRef.colName] = {};

  const id = `${colRef.colName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = new LocalDocRef(colRef.colName, id);

  store[colRef.colName][id] = {
    ...data,
    id
  };

  saveLocalStore(store);
  return docRef;
}

export async function deleteDoc(docRef: LocalDocRef): Promise<void> {
  const store = getLocalStore();
  if (store[docRef.colName] && store[docRef.colName][docRef.id]) {
    delete store[docRef.colName][docRef.id];
    saveLocalStore(store);
  }
}

// Realtime Listener
export function onSnapshot(
  target: LocalDocRef | LocalCollectionRef | LocalQuery,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): () => void {
  const update = async () => {
    try {
      if (target instanceof LocalDocRef) {
        const snap = await getDoc(target);
        onNext(snap);
      } else {
        const snap = await getDocs(target);
        onNext(snap);
      }
    } catch (err) {
      if (onError) {
        try {
          onError(err);
        } catch (e) {
          console.error('onError callback error:', e);
        }
      } else {
        console.error('Snapshot listener error:', err);
      }
    }
  };

  // Initial call
  update();

  // Subscribe to changes
  listeners.add(update);

  return () => {
    listeners.delete(update);
  };
}

// WriteBatch
export class LocalWriteBatch {
  private ops: Array<() => void> = [];

  set(docRef: LocalDocRef, data: any, options?: { merge?: boolean }) {
    this.ops.push(() => {
      const store = getLocalStore();
      if (!store[docRef.colName]) store[docRef.colName] = {};
      if (options?.merge && store[docRef.colName][docRef.id]) {
        store[docRef.colName][docRef.id] = {
          ...store[docRef.colName][docRef.id],
          ...data,
          id: docRef.id
        };
      } else {
        store[docRef.colName][docRef.id] = {
          ...data,
          id: docRef.id
        };
      }
      saveLocalStore(store);
    });
  }

  update(docRef: LocalDocRef, data: any) {
    this.set(docRef, data, { merge: true });
  }

  delete(docRef: LocalDocRef) {
    this.ops.push(() => {
      const store = getLocalStore();
      if (store[docRef.colName] && store[docRef.colName][docRef.id]) {
        delete store[docRef.colName][docRef.id];
        saveLocalStore(store);
      }
    });
  }

  async commit(): Promise<void> {
    this.ops.forEach(op => op());
    this.ops = [];
  }
}

export function writeBatch(db: any): LocalWriteBatch {
  return new LocalWriteBatch();
}

export function serverTimestamp() {
  return new Date().toISOString();
}

// AUTH SYSTEM
const authListeners = new Set<(user: LocalUser | null) => void>();

function notifyAuthListeners() {
  const current = getCurrentAuthUser();
  authListeners.forEach(cb => {
    try {
      cb(current);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
}

export function getCurrentAuthUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error getting auth user:', e);
  }
  return null;
}

export function setCurrentAuthUser(user: LocalUser | null) {
  if (user) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
  notifyAuthListeners();
}

export function getLocalUsers(): Record<string, { uid: string; email: string; password?: string; displayName?: string; role?: string }> {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading auth users:', e);
  }
  return {};
}

export function saveLocalUsers(users: Record<string, any>) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

export const auth = {
  get currentUser(): LocalUser | null {
    return getCurrentAuthUser();
  },
  signOut: async () => signOut(auth)
};

export function onAuthStateChanged(
  authObj: any,
  callback: (user: LocalUser | null) => void,
  onError?: (err: any) => void
): () => void {
  // Call immediately with current
  callback(getCurrentAuthUser());
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

export async function signInWithEmailAndPassword(authObj: any, email: string, password: string): Promise<{ user: LocalUser }> {
  const users = getLocalUsers();
  const normalizedEmail = email.trim().toLowerCase();

  // Find user by email
  const foundUid = Object.keys(users).find(uid => users[uid].email?.toLowerCase() === normalizedEmail);

  if (foundUid) {
    const u = users[foundUid];
    if (u.password && u.password !== password) {
      throw { code: 'auth/wrong-password', message: 'Invalid email or password.' };
    }
    const localUser: LocalUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || u.email.split('@')[0],
      providerData: [{ providerId: 'password', email: u.email }]
    };
    setCurrentAuthUser(localUser);
    return { user: localUser };
  }

  // If no user exists at all, auto-register this email/password as admin
  const isFirst = Object.keys(users).length === 0;
  const newUid = `user_local_${Date.now()}`;
  const newUser = {
    uid: newUid,
    email: normalizedEmail,
    password,
    displayName: normalizedEmail.split('@')[0],
    role: isFirst ? 'admin' : 'user'
  };

  users[newUid] = newUser;
  saveLocalUsers(users);

  // Save profile in users collection as well
  const store = getLocalStore();
  if (!store.users) store.users = {};
  store.users[newUid] = {
    uid: newUid,
    email: normalizedEmail,
    displayName: newUser.displayName,
    role: newUser.role,
    theme: 'luxury',
    createdAt: new Date().toISOString()
  };
  saveLocalStore(store);

  const localUser: LocalUser = {
    uid: newUid,
    email: normalizedEmail,
    displayName: newUser.displayName,
    providerData: [{ providerId: 'password', email: normalizedEmail }]
  };
  setCurrentAuthUser(localUser);
  return { user: localUser };
}

export async function createUserWithEmailAndPassword(authObj: any, email: string, password: string): Promise<{ user: LocalUser }> {
  const users = getLocalUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = Object.keys(users).find(uid => users[uid].email?.toLowerCase() === normalizedEmail);
  if (existing) {
    throw { code: 'auth/email-already-in-use', message: 'This email is already registered.' };
  }

  const isFirst = Object.keys(users).length === 0;
  const newUid = `user_local_${Date.now()}`;
  const newUser = {
    uid: newUid,
    email: normalizedEmail,
    password,
    displayName: normalizedEmail.split('@')[0],
    role: isFirst ? 'admin' : 'user'
  };

  users[newUid] = newUser;
  saveLocalUsers(users);

  // Create user profile document in local store
  const store = getLocalStore();
  if (!store.users) store.users = {};
  store.users[newUid] = {
    uid: newUid,
    email: normalizedEmail,
    displayName: newUser.displayName,
    role: newUser.role,
    theme: 'luxury',
    createdAt: new Date().toISOString()
  };
  saveLocalStore(store);

  const localUser: LocalUser = {
    uid: newUid,
    email: normalizedEmail,
    displayName: newUser.displayName,
    providerData: [{ providerId: 'password', email: normalizedEmail }]
  };
  setCurrentAuthUser(localUser);
  return { user: localUser };
}

export async function updateProfile(userObj: LocalUser, data: { displayName?: string; photoURL?: string }): Promise<void> {
  const current = getCurrentAuthUser();
  if (current) {
    const updated = {
      ...current,
      ...(data.displayName ? { displayName: data.displayName } : {}),
      ...(data.photoURL ? { photoURL: data.photoURL } : {})
    };
    setCurrentAuthUser(updated);

    // Update in local store
    const store = getLocalStore();
    if (store.users && store.users[current.uid]) {
      store.users[current.uid] = {
        ...store.users[current.uid],
        ...data
      };
      saveLocalStore(store);
    }
  }
}

export async function sendPasswordResetEmail(authObj: any, email: string): Promise<void> {
  console.log(`[Local Auth] Reset link requested for ${email}`);
}

export async function signInWithPopup(authObj: any, provider: any): Promise<{ user: LocalUser }> {
  // Local machine sign-in fallback for Google
  const email = 'local.user@guesthouse.local';
  return signInWithEmailAndPassword(authObj, email, 'localpass');
}

export class GoogleAuthProvider {}

export async function signOut(authObj: any): Promise<void> {
  setCurrentAuthUser(null);
}

// Export db instance placeholder
export const db = { name: 'local-guesthouse-db' };
