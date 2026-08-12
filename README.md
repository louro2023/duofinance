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
- ambiente de administrador geral para criar, suspender e redefinir senhas de usuários;
- um ambiente financeiro privado e independente para cada usuário;
- modo casa/casal com um segundo acesso próprio compartilhando o mesmo ambiente financeiro;
- reset das finanças limitado ao ambiente da conta conectada;
- layout responsivo e instalação como PWA;
- sincronização com o Firebase por uma API no mesmo domínio, com cache local para falhas temporárias de conexão.

## Como as áreas se conectam

O sistema utiliza uma única base de cálculo para evitar divergências entre telas:

1. **Ajustes** define o espaço e as receitas recorrentes que formam a entrada base de cada mês.
2. **Planejamento** define limites por categoria e quanto deve ser reservado para cada meta.
3. **Lançamentos** registra receitas extras, despesas, recorrências, parcelas e aportes realizados.
4. **Visão geral** combina essas informações para gerar saldo projetado, pendências e gráficos.

No primeiro uso, o aplicativo encaminha a pessoa para a primeira etapa ainda não preenchida. Todas as telas apresentam a ordem recomendada e instruções específicas de preenchimento.

```text
Saldo projetado = receitas recorrentes + receitas extras − despesas − reservas ainda não realizadas
```

Um aporte registrado em uma meta também cria uma saída vinculada nos lançamentos. Se esse lançamento for editado, removido ou marcado como pendente, o progresso da meta é recalculado junto.

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

Em desenvolvimento, o Vite executa localmente as rotas de autenticação, administração e finanças. Na Vercel, as funções em `api/` fazem essa intermediação para evitar problemas de WebSocket, DNS e bloqueios de rede no navegador.

No primeiro acesso após a atualização, o sistema solicita a criação do administrador geral e migra os dados financeiros existentes para o espaço principal. Depois disso, novas contas são criadas pela central administrativa e começam sem lançamentos.

Para produção, mantenha a base do Firebase privada e configure `FIREBASE_DATABASE_AUTH` nas variáveis da Vercel com uma credencial de acesso ao Realtime Database. `FIREBASE_DATABASE_URL` é opcional e permite trocar a URL/base usada pelas funções. Não coloque essas credenciais em variáveis iniciadas por `VITE_`, pois elas seriam expostas no navegador.
