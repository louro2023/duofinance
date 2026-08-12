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
- usuários adicionais compartilhando o mesmo espaço financeiro;
- reset somente das finanças ou reset completo do sistema;
- layout responsivo e instalação como PWA;
- sincronização pelo Firebase Realtime Database.

## Como as áreas se conectam

O sistema utiliza uma única base de cálculo para evitar divergências entre telas:

1. **Ajustes** define as receitas recorrentes que formam a entrada base de cada mês.
2. **Lançamentos** registra receitas extras, despesas, recorrências, parcelas e aportes realizados.
3. **Planejamento** compara os lançamentos com os limites por categoria e calcula quanto ainda precisa ser reservado para cada meta.
4. **Visão geral** combina essas informações para gerar saldo projetado, pendências e gráficos.

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

> Antes de publicar, configure regras privadas no Firebase Realtime Database. A configuração do cliente não substitui autenticação e regras de acesso no servidor.
