import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const DATABASE_ROOT = process.env.FIREBASE_DATABASE_URL || 'https://duofinance-5b1d8-default-rtdb.firebaseio.com/projects/duofinance';

export const firebaseRequest = async (path: string, method = 'GET', body?: unknown) => {
  const cleanPath = path.replace(/^\//, '');
  const authQuery = process.env.FIREBASE_DATABASE_AUTH ? `?auth=${encodeURIComponent(process.env.FIREBASE_DATABASE_AUTH)}` : '';
  const response = await fetch(`${DATABASE_ROOT}${cleanPath ? `/${cleanPath}` : ''}.json${authQuery}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Firebase HTTP ${response.status}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const normalizeList = <T>(value: T[] | Record<string, T> | null): T[] =>
  value ? (Array.isArray(value) ? value.filter(Boolean) : Object.values(value)) : [];

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored = '') => {
  if (stored.startsWith('pbkdf2:')) {
    const [, salt, expected] = stored.split(':');
    const actual = pbkdf2Sync(password, salt, 120000, 32, 'sha256');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  }
  if (stored.startsWith('sha256:')) {
    return `sha256:${createHash('sha256').update(password).digest('hex')}` === stored;
  }
  return password === stored;
};

export const createSession = async (accountId: string) => {
  const token = randomBytes(32).toString('hex');
  await firebaseRequest(`sessions/${token}`, 'PUT', {
    accountId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  return token;
};

export const authenticate = async (request: any) => {
  const header = String(request.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const session = await firebaseRequest(`sessions/${token}`);
  if (!session || session.expiresAt < Date.now()) {
    if (session) await firebaseRequest(`sessions/${token}`, 'DELETE');
    return null;
  }
  const account = await firebaseRequest(`accounts/${session.accountId}`);
  if (!account?.active) return null;
  const { password: _password, ...safeAccount } = account;
  return { token, account: safeAccount };
};

export const publicAccount = (account: any) => {
  const { password: _password, ...safe } = account;
  return safe;
};
