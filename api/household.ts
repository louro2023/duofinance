import { authenticate, firebaseRequest, hashPassword, normalizeList, publicAccount } from './_auth.js';

const newId = () => `acc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const auth = await authenticate(request);
    if (!auth) return response.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    const workspaceId = auth.account.workspaceId;
    const accounts = normalizeList<any>(await firebaseRequest('accounts'));
    const workspaceAccounts = accounts.filter(account => account.workspaceId === workspaceId);

    if (request.method === 'GET') {
      return response.status(200).json({ accounts: workspaceAccounts.map(publicAccount) });
    }

    if (auth.account.accessLevel === 'MEMBER') {
      return response.status(403).json({ error: 'Somente a conta principal pode gerenciar os acessos da casa.' });
    }

    if (request.method === 'POST') {
      const settings = await firebaseRequest(`workspaces/${workspaceId}/settings`);
      if (settings?.mode !== 'HOUSEHOLD') return response.status(409).json({ error: 'Ative o modo Controle da casa / casal antes de adicionar um acesso.' });
      const name = String(request.body?.name || '').trim();
      const email = String(request.body?.email || '').trim().toLowerCase();
      const password = String(request.body?.password || '');
      if (name.length < 2 || !email.includes('@') || password.length < 6) {
        return response.status(400).json({ error: 'Informe nome, e-mail válido e senha de pelo menos 6 caracteres.' });
      }
      if (accounts.some(account => account.email === email)) return response.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      const accountId = newId();
      const account = { id: accountId, name, email, password: hashPassword(password), role: 'USER', workspaceId, accessLevel: 'MEMBER', active: true, createdAt: new Date().toISOString() };
      await firebaseRequest(`accounts/${accountId}`, 'PUT', account);
      return response.status(201).json({ account: publicAccount(account) });
    }

    if (request.method === 'DELETE') {
      const accountId = String(request.body?.accountId || '');
      const target = workspaceAccounts.find(account => account.id === accountId);
      if (!target || target.id === auth.account.id || target.accessLevel !== 'MEMBER') return response.status(404).json({ error: 'Acesso compartilhado não encontrado.' });
      const sessions = (await firebaseRequest('sessions')) || {};
      const sessionPatch = Object.fromEntries(Object.entries(sessions).filter(([, session]: any) => session.accountId === accountId).map(([token]) => [token, null]));
      await firebaseRequest('', 'PATCH', { [`accounts/${accountId}`]: null, ...Object.fromEntries(Object.entries(sessionPatch).map(([token, value]) => [`sessions/${token}`, value])) });
      return response.status(204).end();
    }

    response.setHeader('Allow', 'GET, POST, DELETE');
    return response.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Household API error:', error);
    return response.status(503).json({ error: 'Serviço de acessos da casa indisponível.' });
  }
}
