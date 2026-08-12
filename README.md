# DuoFinance

Controle financeiro pessoal ou doméstico, feito para uma pessoa centralizar os lançamentos com rapidez e clareza.

## Recursos

- visão mensal de entradas, despesas, pendências e saldo projetado;
- despesas únicas, recorrentes e parceladas;
- receitas mensais e receitas extras;
- busca, filtros, edição e confirmação de lançamentos;
- limites mensais por categoria;
- metas com prazo, aporte mensal e aportes extras;
- backup JSON e exportação CSV;
- layout responsivo e instalação como PWA;
- sincronização pelo Firebase Realtime Database.

## Desenvolvimento

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

> Antes de publicar, configure regras privadas no Firebase Realtime Database. A configuração do cliente não substitui autenticação e regras de acesso no servidor.
