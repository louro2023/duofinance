import { createSession, firebaseRequest, hashPassword, normalizeList, publicAccount, verifyPassword, authenticate } from './_auth.js';

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    if (request.method === 'GET') {
      const auth = await authenticate(request);
      if (auth) return response.status(200).json({ account: auth.account, bootstrapRequired: false });
      const accounts = await firebaseRequest('accounts');
      return response.status(200).json({ account: null, bootstrapRequired: normalizeList(accounts).length === 0 });
    }
    if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' });
    const action = request.body?.action;
    if (action === 'bootstrap') {
      const accounts = await firebaseRequest('accounts');
      if (normalizeList(accounts).length) return response.status(409).json({ error: 'O administrador já foi configurado.' });
      const name = String(request.body.name || '').trim();
      const email = String(request.body.email || '').trim().toLowerCase();
      const password = String(request.body.password || '');
      if (!name || !email || password.length < 6) return response.status(400).json({ error: 'Preencha nome, e-mail e uma senha de 6 caracteres.' });

      const root = await firebaseRequest('') || {};
      const accountId = newId('acc');
      const workspaceId = 'workspace_principal';
      const admin = { id: accountId, name, email, password: hashPassword(password), role: 'ADMIN', workspaceId, active: true, createdAt: new Date().toISOString() };
      const migratedAccounts: Record<string, any> = { [accountId]: admin };
      await firebaseRequest('', 'PATCH', {
        accounts: migratedAccounts,
        workspaces: { [workspaceId]: { incomes: root.incomes || null, transactions: root.transactions || null, goals: root.goals || null, budgets: root.budgets || null, settings: root.settings || null } },
        users: null, incomes: null, transactions: null, goals: null, budgets: null, settings: null
      });
      const token = await createSession(accountId);
      return response.status(201).json({ token, account: publicAccount(admin) });
    }
    if (action === 'login') {
      const email = String(request.body.email || '').trim().toLowerCase();
      const password = String(request.body.password || '');
      const accounts = normalizeList<any>(await firebaseRequest('accounts'));
      const account = accounts.find(item => item.email === email);
      if (!account || !account.active || !verifyPassword(password, account.password)) return response.status(401).json({ error: 'E-mail ou senha incorretos.' });
      const token = await createSession(account.id);
      return response.status(200).json({ token, account: publicAccount(account) });
    }
    if (action === 'logout') {
      const auth = await authenticate(request);
      if (auth) await firebaseRequest(`sessions/${auth.token}`, 'DELETE');
      return response.status(204).end();
    }
    return response.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('Auth API error:', error);
    return response.status(503).json({ error: 'Serviço de autenticação indisponível.' });
  }
}
