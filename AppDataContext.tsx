import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../firebase/config';
import {
  ActivityLog,
  BusinessSettings,
  Customer,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_SUPPLIER_CATEGORIES,
  DocumentRecord,
  Expense,
  Installation,
  Lead,
  MeasurementArea,
  NavSection,
  Order,
  Payment,
  ProductionJob,
  PurchaseOrder,
  Quotation,
  ROLE_PERMISSIONS,
  Supplier,
  Survey,
  TaskItem,
  UserProfile,
} from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

const BOOTSTRAPPED_OWNER_EMAIL = 'xanmori86@gmail.com';

const DEFAULT_SETTINGS_BASE = {
  businessName: 'Harmony Interior',
  tagline: 'Custom Curtain & Window Treatment Studio',
  address: '',
  whatsapp: '',
  email: '',
  bankAccounts: '',
  paymentTerms: 'DP 50% saat konfirmasi pesanan, pelunasan 50% sebelum atau saat selesai pemasangan.',
  defaultDpPercentage: 50,
  quotationValidityDays: 14,
  orderPrefix: 'HI',
  quotationPrefix: 'QT',
  poPrefix: 'PO',
  productCategories: DEFAULT_PRODUCT_CATEGORIES,
  supplierCategories: DEFAULT_SUPPLIER_CATEGORIES,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
};

function stripUndefinedValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map((item) => stripUndefinedValue(item)).filter((item) => item !== undefined);
  }
  if (val !== null && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedValue(v);
      }
    }
    return out;
  }
  return val;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return stripUndefinedValue(obj) as Record<string, unknown>;
}

interface AppDataContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  dataLoading: boolean;
  connectionOffline: boolean;
  workspaceOwnerUid: string | null;
  allowedSections: NavSection[];
  activeSection: NavSection;
  focusedRecordId: string | null;
  navigateTo: (section: NavSection, recordId?: string | null) => void;
  clearFocusedRecord: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;

  // Live synced Firestore collections
  users: UserProfile[];
  customers: Customer[];
  leads: Lead[];
  surveys: Survey[];
  measurementAreas: MeasurementArea[];
  quotations: Quotation[];
  orders: Order[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  productionJobs: ProductionJob[];
  installations: Installation[];
  payments: Payment[];
  expenses: Expense[];
  tasks: TaskItem[];
  documents: DocumentRecord[];
  activityLogs: ActivityLog[];
  settings: BusinessSettings;

  // Generic Firestore mutations with automatic timestamps + audit logs
  createRecord: <T extends Record<string, unknown>>(
    collectionName: string,
    payload: T,
    audit?: { action: string; entityType: string; summary: string },
    customId?: string
  ) => Promise<string>;
  updateRecord: <T extends Record<string, unknown>>(
    collectionName: string,
    id: string,
    payload: T,
    audit?: { action: string; entityType: string; summary: string }
  ) => Promise<void>;
  deleteRecord: (
    collectionName: string,
    id: string,
    audit?: { action: string; entityType: string; summary: string }
  ) => Promise<void>;
  saveSettings: (updates: Partial<BusinessSettings>) => Promise<void>;
  logActivity: (action: string, entityType: string, summary: string, entityId?: string) => Promise<void>;

  // Toast helpers
  toasts: ToastMessage[];
  notify: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [connectionOffline, setConnectionOffline] = useState(false);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [measurementAreas, setMeasurementAreas] = useState<MeasurementArea[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settingsDoc, setSettingsDoc] = useState<BusinessSettings | null>(null);

  const notify = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigateTo = useCallback((section: NavSection, recordId?: string | null) => {
    setActiveSection(section);
    setFocusedRecordId(recordId ?? null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const clearFocusedRecord = useCallback(() => {
    setFocusedRecordId(null);
  }, []);

  // Verify Firestore connection on mount
  useEffect(() => {
    testFirestoreConnection().then((res) => {
      if (res.offline) setConnectionOffline(true);
    });
  }, []);

  // Auth listener + User profile bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserProfile(null);
        setAuthLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          setUserProfile({ id: snap.id, ...(snap.data() as Omit<UserProfile, 'id'>) });
        } else {
          const isBootstrappedOwner =
            firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL &&
            firebaseUser.emailVerified;
          const initialProfile = {
            uid: firebaseUser.uid,
            ownerUid: firebaseUser.uid,
            displayName: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pemilik').slice(0, 120),
            email: (firebaseUser.email || '').slice(0, 200),
            photoURL: (firebaseUser.photoURL || '').slice(0, 1000),
            role: isBootstrappedOwner ? ('owner' as const) : ('sales' as const),
            active: true,
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(profileRef, initialProfile);
          const created = await getDoc(profileRef);
          if (created.exists()) {
            setUserProfile({ id: created.id, ...(created.data() as Omit<UserProfile, 'id'>) });
          }
        }
      } catch (err) {
        console.error('User profile init error:', err);
        setUserProfile({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          ownerUid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Pemilik',
          email: firebaseUser.email || '',
          role: 'owner',
          active: true,
        });
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const workspaceOwnerUid = userProfile?.ownerUid || user?.uid || null;

  // Subscribe to all 17 collections in realtime once authenticated
  useEffect(() => {
    if (!user || !workspaceOwnerUid) {
      setUsers([]);
      setCustomers([]);
      setLeads([]);
      setSurveys([]);
      setMeasurementAreas([]);
      setQuotations([]);
      setOrders([]);
      setSuppliers([]);
      setPurchaseOrders([]);
      setProductionJobs([]);
      setInstallations([]);
      setPayments([]);
      setExpenses([]);
      setTasks([]);
      setDocuments([]);
      setActivityLogs([]);
      setSettingsDoc(null);
      return;
    }

    setDataLoading(true);
    let initialLoaded = 0;
    const totalStreams = 16;
    const markLoaded = () => {
      initialLoaded += 1;
      if (initialLoaded >= totalStreams) {
        setDataLoading(false);
      }
    };

    const sortByCreatedDesc = <T extends { createdAt?: { toMillis?: () => number } | null }>(list: T[]): T[] =>
      [...list].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const bindCollection = <T extends { id: string }>(
      name: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const q = query(collection(db, name), where('ownerUid', '==', workspaceOwnerUid));
      let resolvedOnce = false;
      return onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, 'id'>) })) as T[];
          setter(sortByCreatedDesc(rows as unknown as { createdAt?: { toMillis?: () => number } | null }[]) as unknown as T[]);
          if (!resolvedOnce) {
            resolvedOnce = true;
            markLoaded();
          }
        },
        (error) => {
          console.error(`Snapshot error on ${name}:`, error);
          if (!resolvedOnce) {
            resolvedOnce = true;
            markLoaded();
          }
          try {
            handleFirestoreError(error, OperationType.LIST, name);
          } catch {
            notify('error', `Gagal menyinkronkan data ${name}. Periksa koneksi atau izin akses.`);
          }
        }
      );
    };

    const unsubs = [
      bindCollection<UserProfile>('users', setUsers),
      bindCollection<Customer>('customers', setCustomers),
      bindCollection<Lead>('leads', setLeads),
      bindCollection<Survey>('surveys', setSurveys),
      bindCollection<MeasurementArea>('measurementAreas', setMeasurementAreas),
      bindCollection<Quotation>('quotations', setQuotations),
      bindCollection<Order>('orders', setOrders),
      bindCollection<Supplier>('suppliers', setSuppliers),
      bindCollection<PurchaseOrder>('purchaseOrders', setPurchaseOrders),
      bindCollection<ProductionJob>('productionJobs', setProductionJobs),
      bindCollection<Installation>('installations', setInstallations),
      bindCollection<Payment>('payments', setPayments),
      bindCollection<Expense>('expenses', setExpenses),
      bindCollection<TaskItem>('tasks', setTasks),
      bindCollection<DocumentRecord>('documents', setDocuments),
      bindCollection<ActivityLog>('activityLogs', setActivityLogs),
    ];

    // Settings document
    const settingsRef = doc(db, 'settings', workspaceOwnerUid);
    const unsubSettings = onSnapshot(
      settingsRef,
      async (snap) => {
        if (snap.exists()) {
          setSettingsDoc({ id: snap.id, ...(snap.data() as Omit<BusinessSettings, 'id'>) });
        } else {
          try {
            await setDoc(settingsRef, {
              ...DEFAULT_SETTINGS_BASE,
              ownerUid: workspaceOwnerUid,
              updatedBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            console.error('Failed to bootstrap default settings:', err);
          }
        }
      },
      (error) => {
        console.error('Settings snapshot error:', error);
      }
    );

    const safetyTimeout = window.setTimeout(() => setDataLoading(false), 2500);

    return () => {
      window.clearTimeout(safetyTimeout);
      unsubs.forEach((u) => u());
      unsubSettings();
    };
  }, [user, workspaceOwnerUid, notify]);

  const settings: BusinessSettings = useMemo(
    () =>
      settingsDoc || {
        id: workspaceOwnerUid || 'default',
        ownerUid: workspaceOwnerUid || '',
        ...DEFAULT_SETTINGS_BASE,
      },
    [settingsDoc, workspaceOwnerUid]
  );

  const allowedSections: NavSection[] = useMemo(() => {
    if (!user || !userProfile) return [];
    // Workspace owner or bootstrapped owner has full access to all modules
    if (
      userProfile.role === 'owner' ||
      userProfile.ownerUid === user.uid ||
      user.email?.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL
    ) {
      return ROLE_PERMISSIONS.owner;
    }
    return ROLE_PERMISSIONS[userProfile.role] || ROLE_PERMISSIONS.sales;
  }, [user, userProfile]);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      notify('success', 'Berhasil masuk ke Harmony Interior.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (!msg.includes('popup-closed-by-user')) {
        notify('error', `Gagal login: ${msg}`);
      }
      throw err;
    }
  }, [notify]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setActiveSection('dashboard');
    setFocusedRecordId(null);
    notify('info', 'Anda telah keluar dari akun.');
  }, [notify]);

  const logActivity = useCallback(
    async (action: string, entityType: string, summary: string, entityId?: string) => {
      if (!user || !workspaceOwnerUid) return;
      try {
        const ref = doc(collection(db, 'activityLogs'));
        await setDoc(
          ref,
          stripUndefined({
            ownerUid: workspaceOwnerUid,
            action: action.slice(0, 120),
            entityType: entityType.slice(0, 60),
            entityId: entityId ? entityId.slice(0, 128) : undefined,
            summary: summary.slice(0, 500),
            actorUid: user.uid,
            actorName: (userProfile?.displayName || user.displayName || user.email || 'Pengguna').slice(0, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        console.error('Activity log error:', err);
      }
    },
    [user, workspaceOwnerUid, userProfile]
  );

  const createRecord = useCallback(
    async <T extends Record<string, unknown>>(
      collectionName: string,
      payload: T,
      audit?: { action: string; entityType: string; summary: string },
      customId?: string
    ): Promise<string> => {
      if (!user || !workspaceOwnerUid) {
        throw new Error('Silakan login terlebih dahulu.');
      }
      const ref = customId ? doc(db, collectionName, customId) : doc(collection(db, collectionName));
      const supportsUpdatedBy = collectionName !== 'users' && collectionName !== 'documents';
      const fullPayload = stripUndefined({
        ...payload,
        ownerUid: workspaceOwnerUid,
        createdBy: user.uid,
        ...(supportsUpdatedBy ? { updatedBy: user.uid } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      try {
        await setDoc(ref, fullPayload);
        if (audit) {
          await logActivity(audit.action, audit.entityType, audit.summary, ref.id);
        }
        return ref.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${collectionName}/${ref.id}`);
      }
    },
    [user, workspaceOwnerUid, logActivity]
  );

  const updateRecord = useCallback(
    async <T extends Record<string, unknown>>(
      collectionName: string,
      id: string,
      payload: T,
      audit?: { action: string; entityType: string; summary: string }
    ): Promise<void> => {
      if (!user || !workspaceOwnerUid) {
        throw new Error('Silakan login terlebih dahulu.');
      }
      const ref = doc(db, collectionName, id);
      const supportsUpdatedBy = collectionName !== 'users' && collectionName !== 'documents';
      const cleanPayload = stripUndefined({
        ...payload,
        ...(supportsUpdatedBy ? { updatedBy: user.uid } : {}),
        updatedAt: serverTimestamp(),
      });
      // Strip immutable fields if accidentally passed
      delete cleanPayload.id;
      delete cleanPayload.createdAt;
      delete cleanPayload.createdBy;
      delete cleanPayload.ownerUid;

      try {
        await updateDoc(ref, cleanPayload);
        if (audit) {
          await logActivity(audit.action, audit.entityType, audit.summary, id);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
      }
    },
    [user, workspaceOwnerUid, logActivity]
  );

  const deleteRecord = useCallback(
    async (
      collectionName: string,
      id: string,
      audit?: { action: string; entityType: string; summary: string }
    ): Promise<void> => {
      if (!user || !workspaceOwnerUid) {
        throw new Error('Silakan login terlebih dahulu.');
      }
      const ref = doc(db, collectionName, id);
      try {
        await deleteDoc(ref);
        if (audit) {
          await logActivity(audit.action, audit.entityType, audit.summary, id);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
      }
    },
    [user, workspaceOwnerUid, logActivity]
  );

  const saveSettings = useCallback(
    async (updates: Partial<BusinessSettings>) => {
      if (!user || !workspaceOwnerUid) return;
      const ref = doc(db, 'settings', workspaceOwnerUid);
      const clean = stripUndefined({
        ...updates,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      delete clean.id;
      delete clean.createdAt;
      delete clean.ownerUid;

      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, clean);
        } else {
          await setDoc(
            ref,
            stripUndefined({
              ...DEFAULT_SETTINGS_BASE,
              ...updates,
              ownerUid: workspaceOwnerUid,
              updatedBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
        await logActivity('Pengaturan diperbarui', 'settings', 'Profil & konfigurasi Harmony Interior diperbarui', workspaceOwnerUid);
        notify('success', 'Pengaturan bisnis berhasil disimpan.');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `settings/${workspaceOwnerUid}`);
      }
    },
    [user, workspaceOwnerUid, logActivity, notify]
  );

  const value: AppDataContextValue = {
    user,
    userProfile,
    authLoading,
    dataLoading,
    connectionOffline,
    workspaceOwnerUid,
    allowedSections,
    activeSection,
    focusedRecordId,
    navigateTo,
    clearFocusedRecord,
    loginWithGoogle,
    logout,
    users,
    customers,
    leads,
    surveys,
    measurementAreas,
    quotations,
    orders,
    suppliers,
    purchaseOrders,
    productionJobs,
    installations,
    payments,
    expenses,
    tasks,
    documents,
    activityLogs,
    settings,
    createRecord,
    updateRecord,
    deleteRecord,
    saveSettings,
    logActivity,
    toasts,
    notify,
    dismissToast,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
