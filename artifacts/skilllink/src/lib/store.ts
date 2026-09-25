export type Role = 'customer' | 'fundi';
export type JobStatus = 'Requested' | 'Accepted' | 'In progress' | 'Completed';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  location: string;
  password?: string;
  available?: boolean;
};

export type Fundi = {
  id: string;
  name: string;
  initials: string;
  service: string;
  services: string[];
  location: string;
  experience: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  available: boolean;
  bio: string;
  accent: string;
};

export type Job = {
  id: string;
  customerId: string;
  customerName: string;
  fundiId?: string;
  fundiName?: string;
  service: string;
  location: string;
  details: string;
  preferredDate?: string;
  preferredTime?: string;
  status: JobStatus;
  createdAt: string;
  history: { status: JobStatus; date: string; note: string }[];
};

export const services = [
  { name: 'Appliance Repair', detail: 'Fridges, cookers, washing machines' },
  { name: 'Carpentry', detail: 'Furniture, doors, fittings and repairs' },
  { name: 'Cleaning', detail: 'Home, office and post-construction...' },
  { name: 'Electrical Work', detail: 'Wiring, sockets, lighting, fault finding' },
  { name: 'Gardening & Outdoor', detail: 'Landscaping, lawns and outdoor spaces' },
  { name: 'General Repairs', detail: 'Reliable fixes around your home' },
  { name: 'Masonry', detail: 'Walls, tiling, plaster and concrete' },
  { name: 'Mechanics', detail: 'Vehicle servicing and repairs' },
  { name: 'Plumbing', detail: 'Leaks, pipes, taps, drains and water fixtures' },
];

const seedFundis: Fundi[] = [
  { id: 'f1', name: 'Moses Kariuki', initials: 'MK', service: 'Electrical Work', services: ['Electrical Work', 'General Repairs'], location: 'Kilimani, Nairobi', experience: '8 years', rating: 4.9, reviewCount: 42, verified: true, available: true, bio: 'I help Nairobi homes stay safe, bright and running smoothly. From a flickering light to a full rewiring, I arrive prepared and explain every step.', accent: '#d8eee0' },
  { id: 'f2', name: 'Wanjiku Njeri', initials: 'WN', service: 'Cleaning', services: ['Cleaning', 'Gardening & Outdoor'], location: 'Westlands, Nairobi', experience: '6 years', rating: 4.8, reviewCount: 31, verified: true, available: true, bio: 'A meticulous home and office cleaner with a soft spot for the details others miss. One-off deep cleans and regular visits welcome.', accent: '#f7e4c9' },
  { id: 'f3', name: 'Brian Otieno', initials: 'BO', service: 'Carpentry', services: ['Carpentry', 'General Repairs'], location: 'South B, Nairobi', experience: '11 years', rating: 4.9, reviewCount: 57, verified: true, available: false, bio: 'Furniture, doors and fittings made to last. I bring practical ideas, careful measurements and a clean finish to every job.', accent: '#dfe7d4' },
  { id: 'f4', name: 'Amina Hassan', initials: 'AH', service: 'Appliance Repair', services: ['Appliance Repair', 'Electrical Work'], location: 'Parklands, Nairobi', experience: '7 years', rating: 4.7, reviewCount: 26, verified: true, available: true, bio: 'Fast, honest appliance diagnostics for busy homes. I work on most major fridge, cooker and washing machine brands.', accent: '#f1dfdc' },
  { id: 'f5', name: 'David Mwangi', initials: 'DM', service: 'Masonry', services: ['Masonry', 'Carpentry'], location: 'Lavington, Nairobi', experience: '14 years', rating: 4.8, reviewCount: 38, verified: true, available: true, bio: 'From a neat tile repair to a new garden wall, I take pride in strong work and a site left tidy.', accent: '#e5dfcf' },
  { id: 'f6', name: 'Kevin Wekesa', initials: 'KW', service: 'Mechanics', services: ['Mechanics', 'General Repairs'], location: 'Kasarani, Nairobi', experience: '9 years', rating: 4.6, reviewCount: 19, verified: true, available: true, bio: 'Friendly mobile mechanic for routine servicing and the unexpected moments that get you stuck.', accent: '#d8e8eb' },
];

const seedJobs: Job[] = [
  { id: 'j1', customerId: 'demo-customer', customerName: 'Akinyi Otieno', fundiId: 'f1', fundiName: 'Moses Kariuki', service: 'Electrical Work', location: 'Kilimani, Nairobi', details: 'The kitchen lights keep flickering and one socket is loose.', status: 'In progress', createdAt: '2025-02-14', history: [{ status: 'Requested', date: '14 Feb', note: 'Request sent to Moses Kariuki' }, { status: 'Accepted', date: '14 Feb', note: 'Moses accepted the job' }, { status: 'In progress', date: '15 Feb', note: 'Work has started' }] },
  { id: 'j2', customerId: 'demo-customer', customerName: 'Akinyi Otieno', fundiId: 'f4', fundiName: 'Amina Hassan', service: 'Appliance Repair', location: 'Kilimani, Nairobi', details: 'Washing machine is not draining after a cycle.', status: 'Requested', createdAt: '2025-02-18', history: [{ status: 'Requested', date: '18 Feb', note: 'Request sent to Amina Hassan' }] },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) { if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value)); }

export function ensureStore() {
  if (typeof window === 'undefined') return;
  if (!window.localStorage.getItem('skilllink-fundis')) write('skilllink-fundis', seedFundis);
  if (!window.localStorage.getItem('skilllink-jobs')) write('skilllink-jobs', seedJobs);
  if (!window.localStorage.getItem('skilllink-users')) write('skilllink-users', []);
}
export function getFundis() { ensureStore(); return read<Fundi[]>('skilllink-fundis', seedFundis); }
export function getJobs() { ensureStore(); return read<Job[]>('skilllink-jobs', seedJobs); }
export function getUsers() { ensureStore(); return read<User[]>('skilllink-users', []); }
export function getSession(): User | null { return read<User | null>('skilllink-session', null); }
export function saveSession(user: User | null) { write('skilllink-session', user); }
export function saveUsers(users: User[]) { write('skilllink-users', users); }
export function saveJobs(jobs: Job[]) { write('skilllink-jobs', jobs); }
export function saveFundis(fundis: Fundi[]) { write('skilllink-fundis', fundis); }
export function createJob(data: Pick<Job, 'customerId' | 'customerName' | 'service' | 'location' | 'details'> & Partial<Pick<Job, 'fundiId' | 'fundiName' | 'preferredDate' | 'preferredTime'>>) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const created: Job = { ...data, id: `j${Date.now()}`, status: 'Requested', createdAt: date, history: [{ status: 'Requested', date: now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }), note: data.fundiName ? `Request sent to ${data.fundiName}` : 'Request posted to trusted fundis' }] };
  const jobs = getJobs(); saveJobs([created, ...jobs]); return created;
}
export function updateJobStatus(id: string, status: JobStatus) {
  const jobs = getJobs();
  const updated = jobs.map((job) => job.id === id ? { ...job, status, history: [...job.history, { status, date: new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }), note: status === 'Accepted' ? `${job.fundiName ?? 'Your fundi'} accepted the job` : status === 'Completed' ? 'Job marked as complete' : 'Work has started' }] } : job);
  saveJobs(updated); return updated.find((job) => job.id === id);
}
export function toggleFundiAvailability(id: string) {
  const fundis = getFundis(); const next = fundis.map((fundi) => fundi.id === id ? { ...fundi, available: !fundi.available } : fundi); saveFundis(next); return next.find((fundi) => fundi.id === id);
}