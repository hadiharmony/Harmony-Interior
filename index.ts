import { Timestamp } from 'firebase/firestore';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'sales'
  | 'surveyor'
  | 'operations'
  | 'finance'
  | 'installer';

export type NavSection =
  | 'dashboard'
  | 'customers'
  | 'leads'
  | 'surveys'
  | 'quotations'
  | 'orders'
  | 'suppliers'
  | 'procurement'
  | 'production'
  | 'installations'
  | 'finance'
  | 'tasks'
  | 'documents'
  | 'reports'
  | 'activity'
  | 'settings';

export type PropertyType = 'rumah' | 'apartemen' | 'kantor' | 'hotel' | 'lainnya';
export type LeadSource = 'Instagram' | 'WhatsApp' | 'Referral' | 'Walk-in' | 'Lainnya';

export type LeadStatus =
  | 'New Lead'
  | 'Contacted'
  | 'Survey Scheduled'
  | 'Survey Completed'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type SurveyStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Rescheduled' | 'Cancelled';

export type QuotationStatus =
  | 'Draft'
  | 'Sent'
  | 'Viewed'
  | 'Revision'
  | 'Approved'
  | 'Rejected'
  | 'Expired';

export type OrderStatus =
  | 'New Order'
  | 'Waiting for DP'
  | 'Confirmed'
  | 'Procurement Needed'
  | 'PO Sent to Supplier'
  | 'Material Ordered'
  | 'Material Received'
  | 'Production / Sewing'
  | 'Quality Control'
  | 'Ready for Installation'
  | 'Installation Scheduled'
  | 'Installation in Progress'
  | 'Completed'
  | 'Closed'
  | 'On Hold'
  | 'Cancelled';

export type PurchaseOrderStatus =
  | 'Draft'
  | 'Approved'
  | 'Sent'
  | 'Confirmed by Supplier'
  | 'In Process'
  | 'Ready'
  | 'Shipped'
  | 'Received'
  | 'Partial Received'
  | 'Cancelled';

export type ProductionStatus =
  | 'Not Started'
  | 'Material Preparation'
  | 'Cutting'
  | 'Sewing'
  | 'Finishing'
  | 'Quality Check'
  | 'Ready'
  | 'Delayed';

export type InstallationStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'On the Way'
  | 'In Progress'
  | 'Completed'
  | 'Rescheduled'
  | 'Cancelled';

export type PaymentType = 'DP' | 'Termin' | 'Pelunasan' | 'Additional payment' | 'Refund';
export type PaymentMethod = 'Cash' | 'Transfer bank' | 'QRIS' | 'Other';
export type PaymentSummaryStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Overpaid';

export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Cancelled';

export type DocumentCategory =
  | 'Quotation'
  | 'Purchase Order'
  | 'Invoice'
  | 'Bukti Pembayaran'
  | 'Foto Survey'
  | 'Foto Produk'
  | 'Foto Pemasangan'
  | 'Dokumen Customer'
  | 'Dokumen Supplier'
  | 'Lainnya';

export interface BaseEntity {
  id: string;
  ownerUid: string;
  memberUids?: string[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UserProfile {
  id: string;
  uid: string;
  ownerUid: string;
  displayName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: UserRole;
  active: boolean;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Customer extends BaseEntity {
  customerCode: string;
  name: string;
  whatsapp: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  installationLocation?: string;
  propertyType: PropertyType;
  source: LeadSource;
  firstContactDate?: string;
  notes?: string;
}

export interface FollowUpEntry {
  date: string;
  channel: string;
  note: string;
  by: string;
}

export interface Lead extends BaseEntity {
  name: string;
  whatsapp: string;
  source: string;
  needs?: string;
  estimatedValue?: number;
  nextFollowUpDate?: string;
  status: LeadStatus;
  lostReason?: string;
  communicationNotes?: string;
  followUpHistory?: FollowUpEntry[];
  convertedCustomerId?: string;
}

export interface Survey extends BaseEntity {
  surveyCode: string;
  customerId: string;
  customerName: string;
  projectName: string;
  locationAddress?: string;
  surveyDate: string;
  surveyTime?: string;
  surveyor?: string;
  status: SurveyStatus;
  fieldNotes?: string;
  photoUrls?: string[];
}

export interface MeasurementArea extends BaseEntity {
  surveyId: string;
  customerId: string;
  roomName: string;
  windowName: string;
  widthCm: number;
  heightCm: number;
  quantity: number;
  curtainType?: string;
  model?: string;
  fabricType?: string;
  color?: string;
  pattern?: string;
  railType?: string;
  accessories?: string;
  notes?: string;
  photoUrl?: string;
}

export interface QuotationItem {
  id: string;
  roomName: string;
  windowName: string;
  productType: string;
  specification: string;
  widthCm?: number;
  heightCm?: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface QuotationRevisionEntry {
  revision: number;
  date: string;
  totalAmount: number;
  note: string;
  by: string;
}

export interface Quotation extends BaseEntity {
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerWhatsapp?: string;
  surveyId?: string;
  projectName: string;
  quotationDate: string;
  validUntil?: string;
  revisionNumber?: number;
  items?: QuotationItem[];
  subtotal?: number;
  discount?: number;
  surveyFee?: number;
  installationFee?: number;
  transportFee?: number;
  additionalFee?: number;
  totalAmount: number;
  dpPercentage?: number;
  dpAmount?: number;
  remainingAmount?: number;
  paymentTerms?: string;
  notes?: string;
  status: QuotationStatus;
  revisionHistory?: QuotationRevisionEntry[];
  convertedOrderId?: string;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  date: string;
  note: string;
  by: string;
}

export interface Order extends BaseEntity {
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerWhatsapp?: string;
  quotationId?: string;
  quotationNumber?: string;
  surveyId?: string;
  projectName: string;
  installationAddress?: string;
  orderDate: string;
  targetCompletionDate?: string;
  targetInstallationDate?: string;
  items?: QuotationItem[];
  totalAmount: number;
  dpAmount?: number;
  estimatedCost?: number;
  status: OrderStatus;
  timeline?: OrderTimelineEntry[];
  notes?: string;
}

export interface Supplier extends BaseEntity {
  supplierCode: string;
  name: string;
  contactPerson?: string;
  whatsapp: string;
  address?: string;
  category: string;
  bankInfo?: string;
  notes?: string;
}

export interface PurchaseOrderItem {
  id: string;
  itemName: string;
  specification: string;
  color: string;
  size: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseOrder extends BaseEntity {
  poNumber: string;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  supplierId: string;
  supplierName: string;
  supplierWhatsapp?: string;
  poDate: string;
  targetArrivalDate?: string;
  receivedDate?: string;
  items?: PurchaseOrderItem[];
  subtotal?: number;
  shippingCost?: number;
  additionalCost?: number;
  totalAmount: number;
  paidAmount?: number;
  status: PurchaseOrderStatus;
  delayNotes?: string;
  notes?: string;
}

export interface ProductionJob extends BaseEntity {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  supplierId?: string;
  workshopName: string;
  itemSummary: string;
  specification?: string;
  status: ProductionStatus;
  startDate?: string;
  estimatedFinishDate?: string;
  actualFinishDate?: string;
  notes?: string;
}

export interface InstallationChecklist {
  productsReceived: boolean;
  componentsComplete: boolean;
  railsInstalled: boolean;
  curtainsInstalled: boolean;
  functioningWell: boolean;
  workAreaClean: boolean;
  customerInspected: boolean;
  photoDocumentationDone: boolean;
}

export interface Installation extends BaseEntity {
  installationCode: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerWhatsapp?: string;
  address?: string;
  scheduledDate: string;
  scheduledTime?: string;
  installerName?: string;
  transportInfo?: string;
  status: InstallationStatus;
  checklist?: InstallationChecklist;
  notes?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

export interface Payment extends BaseEntity {
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  paymentDate: string;
  amount: number;
  paymentType: PaymentType;
  method: PaymentMethod;
  proofUrl?: string;
  notes?: string;
}

export interface Expense extends BaseEntity {
  expenseDate: string;
  category: string;
  amount: number;
  description: string;
  orderId?: string;
  orderNumber?: string;
  poId?: string;
  method: PaymentMethod;
  proofUrl?: string;
}

export interface TaskItem extends BaseEntity {
  title: string;
  description?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  relatedType?: string;
  relatedId?: string;
  relatedLabel?: string;
}

export interface DocumentRecord extends BaseEntity {
  title: string;
  category: DocumentCategory;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  downloadUrl: string;
  relatedType?: string;
  relatedId?: string;
  relatedLabel?: string;
  notes?: string;
}

export interface ActivityLog extends BaseEntity {
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  actorUid: string;
  actorName: string;
}

export interface BusinessSettings extends BaseEntity {
  businessName: string;
  tagline?: string;
  address?: string;
  whatsapp?: string;
  email?: string;
  bankAccounts?: string;
  paymentTerms?: string;
  defaultDpPercentage: number;
  quotationValidityDays: number;
  orderPrefix?: string;
  quotationPrefix?: string;
  poPrefix?: string;
  productCategories?: string[];
  supplierCategories?: string[];
  expenseCategories?: string[];
}

export const ORDER_WORKFLOW_STATUSES: OrderStatus[] = [
  'New Order',
  'Waiting for DP',
  'Confirmed',
  'Procurement Needed',
  'PO Sent to Supplier',
  'Material Ordered',
  'Material Received',
  'Production / Sewing',
  'Quality Control',
  'Ready for Installation',
  'Installation Scheduled',
  'Installation in Progress',
  'Completed',
  'Closed',
  'On Hold',
  'Cancelled',
];

export const LEAD_STATUSES: LeadStatus[] = [
  'New Lead',
  'Contacted',
  'Survey Scheduled',
  'Survey Completed',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
];

export const QUOTATION_STATUSES: QuotationStatus[] = [
  'Draft',
  'Sent',
  'Viewed',
  'Revision',
  'Approved',
  'Rejected',
  'Expired',
];

export const PO_STATUSES: PurchaseOrderStatus[] = [
  'Draft',
  'Approved',
  'Sent',
  'Confirmed by Supplier',
  'In Process',
  'Ready',
  'Shipped',
  'Received',
  'Partial Received',
  'Cancelled',
];

export const PRODUCTION_STATUSES: ProductionStatus[] = [
  'Not Started',
  'Material Preparation',
  'Cutting',
  'Sewing',
  'Finishing',
  'Quality Check',
  'Ready',
  'Delayed',
];

export const INSTALLATION_STATUSES: InstallationStatus[] = [
  'Scheduled',
  'Confirmed',
  'On the Way',
  'In Progress',
  'Completed',
  'Rescheduled',
  'Cancelled',
];

export const DEFAULT_PRODUCT_CATEGORIES: string[] = [
  'Gorden Kain',
  'Sheer / Vitrase',
  'Blackout',
  'Dimout',
  'Roman Shade',
  'Roller Blind',
  'Vertical Blind',
  'Horizontal Blind',
  'Wallpaper',
  'Rel / Track',
  'Bracket',
  'Tieback / Tassel',
  'Aksesoris',
  'Produk Lainnya',
];

export const DEFAULT_SUPPLIER_CATEGORIES: string[] = [
  'Produsen Kain',
  'Pabrik Gorden',
  'Supplier Aksesoris',
  'Supplier Rel',
  'Workshop Penjahitan',
  'Vendor Lainnya',
];

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Pembelian Bahan',
  'Pembayaran Supplier',
  'Ongkir',
  'Transportasi',
  'Pemasangan',
  'Operasional',
  'Marketing',
  'Lainnya',
];

export const DEFAULT_CHECKLIST: InstallationChecklist = {
  productsReceived: false,
  componentsComplete: false,
  railsInstalled: false,
  curtainsInstalled: false,
  functioningWell: false,
  workAreaClean: false,
  customerInspected: false,
  photoDocumentationDone: false,
};

export const CHECKLIST_LABELS: { key: keyof InstallationChecklist; label: string }[] = [
  { key: 'productsReceived', label: 'Produk sudah diterima di lokasi' },
  { key: 'componentsComplete', label: 'Semua komponen, rel & aksesoris lengkap' },
  { key: 'railsInstalled', label: 'Rel / track terpasang rapi & kuat' },
  { key: 'curtainsInstalled', label: 'Gorden / blind sudah dipasang' },
  { key: 'functioningWell', label: 'Produk berfungsi dan ditarik dengan baik' },
  { key: 'workAreaClean', label: 'Area kerja bersih dari debu & sisa kemasan' },
  { key: 'customerInspected', label: 'Pelanggan telah memeriksa hasil pemasangan' },
  { key: 'photoDocumentationDone', label: 'Dokumentasi foto sebelum & sesudah selesai' },
];

export const ROLE_PERMISSIONS: Record<UserRole, NavSection[]> = {
  owner: [
    'dashboard', 'customers', 'leads', 'surveys', 'quotations', 'orders',
    'suppliers', 'procurement', 'production', 'installations', 'finance',
    'tasks', 'documents', 'reports', 'activity', 'settings',
  ],
  admin: [
    'dashboard', 'customers', 'leads', 'surveys', 'quotations', 'orders',
    'suppliers', 'procurement', 'production', 'installations', 'finance',
    'tasks', 'documents', 'reports', 'activity',
  ],
  sales: ['dashboard', 'customers', 'leads', 'surveys', 'quotations', 'orders', 'tasks', 'documents'],
  surveyor: ['dashboard', 'customers', 'surveys', 'tasks', 'documents'],
  operations: ['dashboard', 'orders', 'suppliers', 'procurement', 'production', 'installations', 'tasks', 'documents'],
  finance: ['dashboard', 'orders', 'suppliers', 'procurement', 'finance', 'reports', 'documents'],
  installer: ['dashboard', 'installations', 'tasks', 'documents'],
};
