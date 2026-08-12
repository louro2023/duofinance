import { authenticate, firebaseRequest } from './_auth.js';

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH');
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const auth = await authenticate(request);
    if (!auth) return response.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    const path = `workspaces/${auth.account.workspaceId}`;
    if (request.method === 'PATCH') {
      await firebaseRequest(path, 'PATCH', request.body || {});
      return response.status(204).end();
    }
    return response.status(200).json((await firebaseRequest(path)) || {});
  } catch (error) {
    console.error('Finance API error:', error);
    return response.status(503).json({ error: 'Serviço de sincronização indisponível.' });
  }
}
