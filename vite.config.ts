import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import authHandler from './api/auth.ts';
import adminHandler from './api/admin.ts';
import financeHandler from './api/finance.ts';

const localApi = (): Plugin => ({
  name: 'duofinance-local-api',
  configureServer(server) {
    const routes: Record<string, (request: any, response: any) => Promise<any>> = {
      '/api/auth': authHandler,
      '/api/admin': adminHandler,
      '/api/finance': financeHandler
    };
    server.middlewares.use(async (request, response, next) => {
      const handler = routes[String(request.url || '').split('?')[0]];
      if (!handler) return next();
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const apiRequest = { method: request.method, headers: request.headers, body: rawBody ? JSON.parse(rawBody) : {} };
        const apiResponse = {
          setHeader: (name: string, value: string) => response.setHeader(name, value),
          status: (code: number) => {
            response.statusCode = code;
            return {
              json: (value: unknown) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); },
              end: () => response.end()
            };
          }
        };
        await handler(apiRequest, apiResponse);
      } catch (error) {
        server.config.logger.error(error instanceof Error ? error.message : String(error));
        response.statusCode = 500;
        response.end(JSON.stringify({ error: 'Erro na API local.' }));
      }
    });
  }
});

export default defineConfig({
  server: { port: 3000, host: '0.0.0.0' },
  plugins: [react(), localApi()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } }
});
