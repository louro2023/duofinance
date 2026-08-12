import { authenticate, firebaseRequest, hashPassword, normalizeList, publicAccount } from './_auth.js';

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const auth = await authenticate(request);
    if (!auth) return response.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    if (auth.account.role !== 'ADMIN') return response.status(403).json({ error: 'Acesso exclusivo do administrador geral.' });

    if (request.method === 'GET') {
      const accounts = normalizeList<any>(await firebaseRequest('accounts'))
        .map(publicAccount)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      return response.status(200).json({ accounts });
    }

    if (request.method === 'POST') {
      const name = String(request.body?.name || '').trim();
      const email = String(request.body?.email || '').trim().toLowerCase();
      const password = String(request.body?.password || '');
      if (name.length < 2 || !email.includes('@') || password.length < 6) {
        return response.status(400).json({ error: 'Informe nome, e-mail válido e senha de pelo menos 6 caracteres.' });
      }
      const accounts = normalizeList<any>(await firebaseRequest('accounts'));
      if (accounts.some(account => account.email === email)) return response.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      const accountId = newId('acc');
      const workspaceId = newId('ws');
      const account = { id: accountId, name, email, password: hashPassword(password), role: 'USER', workspaceId, accessLevel: 'OWNER', active: true, createdAt: new Date().toISOString() };
      await firebaseRequest('', 'PATCH', {
        [`accounts/${accountId}`]: account,
        [`workspaces/${workspaceId}/settings`]: { householdName: `Finanças de ${name}`, responsibleName: name, mode: 'INDIVIDUAL', hideValues: false }
      });
      return response.status(201).json({ account: publicAccount(account) });
    }

    if (request.method === 'PATCH') {
      const accountId = String(request.body?.accountId || '');
      const account = await firebaseRequest(`accounts/${accountId}`);
      if (!account || account.role === 'ADMIN') return response.status(404).json({ error: 'Usuário não encontrado.' });
      if (request.body?.action === 'resetPassword') {
        const password = String(request.body?.password || '');
        if (password.length < 6) return response.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        await firebaseRequest(`accounts/${accountId}/password`, 'PUT', hashPassword(password));
        await firebaseRequest('sessions', 'PATCH', Object.fromEntries(
          Object.entries((await firebaseRequest('sessions')) || {}).filter(([, session]: any) => session.accountId === accountId).map(([token]) => [token, null])
        ));
        return response.status(200).json({ account: publicAccount(account) });
      }
      if (request.body?.action === 'toggleActive') {
        const active = !account.active;
        await firebaseRequest(`accounts/${accountId}/active`, 'PUT', active);
        return response.status(200).json({ account: publicAccount({ ...account, active }) });
      }
      return response.status(400).json({ error: 'Ação inválida.' });
    }

    response.setHeader('Allow', 'GET, POST, PATCH');
    return response.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Admin API error:', error);
    return response.status(503).json({ error: 'Serviço administrativo indisponível.' });
  }
}
