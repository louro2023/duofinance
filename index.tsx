import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, update } from 'firebase/database';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BellRing, CalendarDays,
  Check, CircleDollarSign, Download, Eye, EyeOff, FileDown,
  LayoutDashboard, LogOut, Pencil, PiggyBank, Plus, Receipt,
  Repeat2, Search, Settings, ShieldCheck, Smartphone, Sparkles, Target, Trash2, TrendingDown,
  TrendingUp, User as UserIcon, WalletCards, X
} from 'lucide-react';
import type {
  AppSettings, CategoryBudget, Income, PaymentMethod, SavingsGoal, Transaction, TransactionKind,
  TransactionType, User
} from './types.ts';
import { CATEGORIES, GOAL_COLORS, INCOME_CATEGORIES, PAYMENT_METHODS } from './constants.tsx';
import './index.css';

const firebaseConfig = {
  apiKey: 'AIzaSyD4MW7KAeVC3h73G0tnGxb9RzQsJ-o6Mco',
  authDomain: 'duofinance-5b1d8.firebaseapp.com',
  projectId: 'duofinance-5b1d8',
  storageBucket: 'duofinance-5b1d8.firebasestorage.app',
  messagingSenderId: '1031506294790',
  appId: '1:1031506294790:web:d9c9851a48ec0ded616b87',
  databaseURL: 'https://duofinance-5b1d8-default-rtdb.firebaseio.com/'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const DB_PATH = 'projects/duofinance';
const DEFAULT_SETTINGS: AppSettings = {
  householdName: 'Meu espaço', responsibleName: '', mode: 'INDIVIDUAL', hideValues: false
};

const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ensureArray = <T,>(value: T[] | Record<string, T> | null | undefined): T[] =>
  value ? (Array.isArray(value) ? value : Object.values(value)) : [];
const monthKey = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (date: Date) => new Intl.DateTimeFormat('pt-BR', {
  month: 'long', year: 'numeric'
}).format(date).replace(/^./, char => char.toUpperCase());
const dateInputValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const money = (value: number, hidden = false) => hidden
  ? 'R$ •••••'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short'
}).format(new Date(value));
const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const hashPassword = async (password: string) => {
  if (!crypto?.subtle) return password;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return `sha256:${Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

type Tab = 'dashboard' | 'transactions' | 'planning' | 'settings';
type ToastState = { message: string; tone?: 'success' | 'error' } | null;

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="modal-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({ label, hint, children, className = '' }: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return <label className={`field ${className}`}><span>{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}

function EmptyState({ icon, title, text, action }: {
  icon: React.ReactNode; title: string; text: string; action?: React.ReactNode;
}) {
  return <div className="empty-state"><div>{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Progress({ value, color = '#7c3aed' }: { value: number; color?: string }) {
  return <div className="progress"><span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /></div>;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [sessionUserId, setSessionUserId] = useState(() => localStorage.getItem('duofinance_session') || '');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [transactionModal, setTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [goalModal, setGoalModal] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(null);
  const [budgetModal, setBudgetModal] = useState(false);
  const [incomeModal, setIncomeModal] = useState<Income | null | 'new'>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [standalone, setStandalone] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | TransactionKind>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const importRef = useRef<HTMLInputElement>(null);

  const notify = (message: string, tone: 'success' | 'error' = 'success') => setToast({ message, tone });

  useEffect(() => {
    const unsubscribe = onValue(ref(db, DB_PATH), snapshot => {
      const data = snapshot.val() || {};
      setUsers(ensureArray<User>(data.users));
      setIncomes(ensureArray<Income>(data.incomes).map(item => ({ ...item, active: item.active !== false })));
      setTransactions(ensureArray<Transaction>(data.transactions).map(item => ({
        ...item, kind: item.kind || 'EXPENSE', isPaid: item.isPaid ?? false
      })));
      setGoals(ensureArray<SavingsGoal>(data.goals));
      setBudgets(ensureArray<CategoryBudget>(data.budgets));
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      setLoading(false);
      setSyncError('');
    }, error => {
      console.error(error);
      setSyncError('Não foi possível sincronizar com a nuvem. Verifique sua conexão.');
      setLoading(false);
    });
    const install = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    window.addEventListener('beforeinstallprompt', install);
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone));
    return () => { unsubscribe(); window.removeEventListener('beforeinstallprompt', install); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const save = async (changes: Record<string, unknown>, successMessage?: string) => {
    try {
      await update(ref(db, DB_PATH), changes);
      if (successMessage) notify(successMessage);
    } catch (error) {
      console.error(error);
      notify('Não foi possível salvar. Tente novamente.', 'error');
    }
  };

  const currentUser = users.find(user => user.id === sessionUserId) || null;
  const loggedIn = Boolean(currentUser);
  const currentKey = monthKey(selectedMonth);
  const activeIncomes = incomes.filter(income => income.active !== false);
  const recurringIncome = activeIncomes.reduce((sum, income) => sum + Number(income.amount || 0), 0);

  const monthTransactions = useMemo(() => transactions.filter(transaction => {
    const transactionKey = monthKey(transaction.date);
    return transaction.type === 'FIXED' ? transactionKey <= currentKey : transactionKey === currentKey;
  }), [transactions, currentKey]);

  const monthlyExpenses = monthTransactions.filter(item => (item.kind || 'EXPENSE') === 'EXPENSE');
  const monthlyExtraIncome = monthTransactions.filter(item => item.kind === 'INCOME');
  const isPaidInSelectedMonth = (item: Transaction) => item.type === 'FIXED'
    ? Boolean(item.paidMonths?.includes(currentKey) || (monthKey(item.date) === currentKey && item.isPaid))
    : item.isPaid;
  const expenseTotal = monthlyExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const incomeTotal = recurringIncome + monthlyExtraIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paidExpenseTotal = monthlyExpenses.filter(isPaidInSelectedMonth).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingTotal = expenseTotal - paidExpenseTotal;
  const monthlyGoalTotal = goals.filter(goal => goal.currentAmount < goal.targetAmount)
    .reduce((sum, goal) => sum + Number(goal.monthlyAmount || 0), 0);
  const projectedBalance = incomeTotal - expenseTotal - monthlyGoalTotal;
  const savingsRate = incomeTotal > 0 ? Math.max(0, (projectedBalance / incomeTotal) * 100) : 0;

  const categoryTotals = useMemo(() => CATEGORIES.map(category => ({
    ...category,
    total: monthlyExpenses.filter(item => item.category === category.id).reduce((sum, item) => sum + item.amount, 0)
  })).filter(item => item.total > 0).sort((a, b) => b.total - a.total), [monthlyExpenses]);

  const visibleTransactions = useMemo(() => monthTransactions.filter(item => {
    const matchesKind = kindFilter === 'ALL' || (item.kind || 'EXPENSE') === kindFilter;
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const query = normalizeText(search);
    const matchesSearch = !query || normalizeText(`${item.name} ${item.notes || ''} ${(item.tags || []).join(' ')}`).includes(query);
    return matchesKind && matchesCategory && matchesSearch;
  }).sort((a, b) => +new Date(b.date) - +new Date(a.date)), [monthTransactions, search, kindFilter, categoryFilter]);

  const moveMonth = (amount: number) => setSelectedMonth(current => {
    const next = new Date(current);
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    return next;
  });

  const handleAccess = async (event: React.FormEvent<HTMLFormElement>, setup: boolean) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    if (setup) {
      const name = String(form.get('name') || '').trim();
      const newUser: User = { id: id(), name, email, password: await hashPassword(password), role: 'OWNER' };
      const initialSettings = { ...DEFAULT_SETTINGS, responsibleName: name, householdName: name };
      await save({ users: [newUser], settings: initialSettings });
      localStorage.setItem('duofinance_session', newUser.id);
      setSessionUserId(newUser.id);
      notify('Seu espaço foi criado. Bem-vindo!');
      return;
    }
    const candidate = users.find(user => user.email.toLowerCase() === email);
    const passwordHash = await hashPassword(password);
    if (!candidate || (candidate.password !== password && candidate.password !== passwordHash)) {
      notify('E-mail ou senha incorretos.', 'error');
      return;
    }
    if (candidate.password && !candidate.password.startsWith('sha256:')) {
      await save({ users: users.map(user => user.id === candidate.id ? { ...user, password: passwordHash } : user) });
    }
    localStorage.setItem('duofinance_session', candidate.id);
    setSessionUserId(candidate.id);
  };

  const logout = () => {
    localStorage.removeItem('duofinance_session');
    setSessionUserId('');
  };

  const submitTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) return;
    const form = new FormData(event.currentTarget);
    const kind = String(form.get('kind')) as TransactionKind;
    const type = String(form.get('type')) as TransactionType;
    const totalAmount = Number(form.get('amount'));
    const installments = type === 'INSTALLMENT' ? Math.max(2, Number(form.get('installments') || 2)) : 1;
    const base: Transaction = {
      ...(editingTransaction || {} as Transaction),
      id: editingTransaction?.id || id(), userId: currentUser.id, kind, type,
      name: String(form.get('name')).trim(), amount: totalAmount,
      category: String(form.get('category')), date: new Date(`${String(form.get('date'))}T12:00:00`).toISOString(),
      paymentMethod: String(form.get('paymentMethod')) as PaymentMethod,
      isPaid: form.get('isPaid') === 'on', notes: String(form.get('notes') || '').trim(),
      tags: String(form.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean)
    };
    let next = [...transactions];
    if (editingTransaction) {
      next = next.map(item => item.id === editingTransaction.id ? base : item);
    } else if (type === 'INSTALLMENT') {
      const parentId = id();
      next.push(...Array.from({ length: installments }, (_, index) => {
        const installmentDate = new Date(base.date);
        installmentDate.setMonth(installmentDate.getMonth() + index);
        return {
          ...base, id: id(), parentId, amount: totalAmount / installments,
          name: `${base.name} (${index + 1}/${installments})`, date: installmentDate.toISOString(),
          installmentsCount: installments, currentInstallment: index + 1, paymentMethod: 'CREDIT' as PaymentMethod
        };
      }));
    } else {
      next.push(base);
    }
    save({ transactions: next }, editingTransaction ? 'Lançamento atualizado.' : 'Lançamento adicionado.');
    setEditingTransaction(null);
    setTransactionModal(false);
  };

  const removeTransaction = (transaction: Transaction) => {
    const removeSeries = transaction.parentId && window.confirm('Excluir todas as parcelas? Clique em Cancelar para excluir apenas esta.');
    const next = transactions.filter(item => removeSeries ? item.parentId !== transaction.parentId : item.id !== transaction.id);
    save({ transactions: next }, 'Lançamento excluído.');
  };

  const togglePaid = (transaction: Transaction) => {
    const currentlyPaid = isPaidInSelectedMonth(transaction);
    const updated = transaction.type === 'FIXED'
      ? { ...transaction, paidMonths: currentlyPaid
          ? (transaction.paidMonths || []).filter(key => key !== currentKey)
          : [...new Set([...(transaction.paidMonths || []), currentKey])] }
      : { ...transaction, isPaid: !transaction.isPaid };
    save({ transactions: transactions.map(item => item.id === transaction.id ? updated : item) },
      currentlyPaid ? 'Marcado como pendente neste mês.' : 'Marcado como pago neste mês.');
  };

  const submitGoal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const goal: SavingsGoal = {
      id: id(), name: String(form.get('name')).trim(), targetAmount: Number(form.get('target')),
      currentAmount: Number(form.get('current') || 0), monthlyAmount: Number(form.get('monthly') || 0),
      deadline: String(form.get('deadline') || ''), color: String(form.get('color') || GOAL_COLORS[0]),
      icon: 'Target', type: 'FIXED', value: Number(form.get('target'))
    };
    save({ goals: [...goals, goal] }, 'Meta criada.');
    setGoalModal(false);
  };

  const addContribution = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contributionGoal) return;
    const value = Number(new FormData(event.currentTarget).get('amount'));
    save({ goals: goals.map(goal => goal.id === contributionGoal.id
      ? { ...goal, currentAmount: Math.min(goal.targetAmount, goal.currentAmount + value) } : goal) }, 'Aporte registrado.');
    setContributionGoal(null);
  };

  const submitBudget = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get('category'));
    const budget: CategoryBudget = { id: budgets.find(item => item.category === category)?.id || id(), category, amount: Number(form.get('amount')) };
    const next = [...budgets.filter(item => item.category !== category), budget];
    save({ budgets: next }, 'Limite mensal salvo.');
    setBudgetModal(false);
  };

  const submitIncome = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) return;
    const form = new FormData(event.currentTarget);
    const income: Income = {
      id: incomeModal && incomeModal !== 'new' ? incomeModal.id : id(), userId: currentUser.id,
      name: String(form.get('name')).trim(), amount: Number(form.get('amount')),
      day: Number(form.get('day')), active: true
    };
    const next = incomeModal && incomeModal !== 'new'
      ? incomes.map(item => item.id === income.id ? income : item) : [...incomes, income];
    save({ incomes: next }, 'Receita mensal salva.');
    setIncomeModal(null);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), users, incomes, transactions, goals, budgets, settings }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `duofinance-backup-${dateInputValue()}.json`; link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportCsv = () => {
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Status'], ...transactions.map(item => [
      item.date.slice(0, 10), item.kind === 'INCOME' ? 'Receita' : 'Despesa', item.name,
      [...CATEGORIES, ...INCOME_CATEGORIES].find(category => category.id === item.category)?.name || item.category,
      item.amount.toFixed(2).replace('.', ','), item.isPaid ? 'Pago' : 'Pendente'
    ])];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `duofinance-lancamentos-${dateInputValue()}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !window.confirm('Restaurar este backup substituirá os dados atuais. Continuar?')) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.transactions) || !Array.isArray(data.incomes)) throw new Error('invalid');
      await save({ incomes: data.incomes, transactions: data.transactions, goals: data.goals || [], budgets: data.budgets || [], settings: data.settings || settings }, 'Backup restaurado.');
    } catch { notify('Arquivo de backup inválido.', 'error'); }
    event.target.value = '';
  };

  const installApp = async () => {
    if (!deferredPrompt) { setInstallHelp(true); return; }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') { setDeferredPrompt(null); setStandalone(true); }
  };

  if (loading) return <div className="splash"><div className="brand-mark"><WalletCards /></div><div className="loader" /><p>Organizando seu espaço financeiro…</p></div>;

  if (!loggedIn) {
    const setup = users.length === 0;
    return <div className="auth-page">
      <div className="auth-art">
        <div className="brand-line"><div className="brand-mark"><WalletCards /></div><b>DuoFinance</b></div>
        <div className="auth-copy"><span>Finanças mais leves</span><h1>Clareza para cuidar do seu dinheiro.</h1><p>Uma visão simples do mês, dos planos e das conquistas — para você ou para a sua casa.</p></div>
        <div className="auth-proof"><ShieldCheck size={20} /><span>Seus dados sincronizados entre seus dispositivos</span></div>
      </div>
      <div className="auth-panel"><div className="auth-card">
        <span className="eyebrow">{setup ? 'Primeiro acesso' : 'Que bom ter você de volta'}</span>
        <h2>{setup ? 'Crie seu espaço' : 'Acesse sua conta'}</h2>
        <p>{setup ? 'Você será a pessoa responsável pelos lançamentos e poderá configurar o espaço como individual ou familiar.' : 'Continue de onde parou.'}</p>
        {syncError && <div className="alert error">{syncError}</div>}
        <form onSubmit={event => handleAccess(event, setup)} className="form-stack">
          {setup && <Field label="Seu nome"><input name="name" required placeholder="Como podemos chamar você?" autoComplete="name" /></Field>}
          <Field label="E-mail"><input name="email" type="email" required placeholder="voce@email.com" autoComplete="email" /></Field>
          <Field label="Senha"><input name="password" type="password" required minLength={4} placeholder="Mínimo de 4 caracteres" autoComplete={setup ? 'new-password' : 'current-password'} /></Field>
          <button className="primary-button wide" type="submit">{setup ? 'Começar agora' : 'Entrar'} <ArrowRight size={18} /></button>
        </form>
      </div></div>
      {toast && <Toast toast={toast} />}
    </div>;
  }

  const hidden = settings.hideValues;
  const profileName = settings.responsibleName || currentUser.name;
  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Visão geral', icon: <LayoutDashboard size={20} /> },
    { id: 'transactions', label: 'Lançamentos', icon: <Receipt size={20} /> },
    { id: 'planning', label: 'Planejamento', icon: <Target size={20} /> },
    { id: 'settings', label: 'Ajustes', icon: <Settings size={20} /> }
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-line"><div className="brand-mark"><WalletCards /></div><b>DuoFinance</b></div>
      <nav>{navItems.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>
      <div className="sidebar-foot"><div className="avatar">{profileName.charAt(0).toUpperCase()}</div><div><b>{profileName}</b><span>{settings.mode === 'HOUSEHOLD' ? 'Espaço familiar' : 'Espaço individual'}</span></div><button onClick={logout} aria-label="Sair"><LogOut size={17} /></button></div>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark small"><WalletCards /></div><b>DuoFinance</b></div>
        <div className="month-switcher"><button onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ArrowLeft size={17} /></button><CalendarDays size={17} /><strong>{monthLabel(selectedMonth)}</strong><button onClick={() => moveMonth(1)} aria-label="Próximo mês"><ArrowRight size={17} /></button></div>
        <div className="top-actions"><button className="icon-button" onClick={() => save({ settings: { ...settings, hideValues: !hidden } })} aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}>{hidden ? <EyeOff size={19} /> : <Eye size={19} />}</button><button className="primary-button compact" onClick={() => { setEditingTransaction(null); setTransactionModal(true); }}><Plus size={18} /> <span>Novo lançamento</span></button></div>
      </header>

      <main className="content">
        {syncError && <div className="alert error">{syncError}</div>}
        {tab === 'dashboard' && <>
          <section className="welcome"><div><span className="eyebrow">{settings.householdName}</span><h1>Olá, {profileName.split(' ')[0]} <span>👋</span></h1><p>Aqui está o retrato financeiro de {monthLabel(selectedMonth).toLowerCase()}.</p></div>{!standalone && <button className="soft-button" onClick={installApp}><Smartphone size={18} /> Instalar aplicativo</button>}</section>

          <section className="balance-hero">
            <div className="hero-orb one" /><div className="hero-orb two" />
            <div className="hero-main"><span>Saldo projetado no mês</span><h2>{money(projectedBalance, hidden)}</h2><div className={`trend-pill ${projectedBalance >= 0 ? 'positive' : 'negative'}`}>{projectedBalance >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{projectedBalance >= 0 ? 'Seu planejamento fecha positivo' : 'Revise despesas e limites'}</div></div>
            <div className="hero-stats"><div><span><ArrowUpRight /> Entradas</span><strong>{money(incomeTotal, hidden)}</strong></div><div><span><ArrowDownRight /> Saídas previstas</span><strong>{money(expenseTotal, hidden)}</strong></div><div><span><PiggyBank /> Para objetivos</span><strong>{money(monthlyGoalTotal, hidden)}</strong></div></div>
          </section>

          <section className="metric-grid">
            <article className="metric-card"><div className="metric-icon violet"><Receipt /></div><span>Contas pendentes</span><strong>{money(pendingTotal, hidden)}</strong><small>{monthlyExpenses.filter(item => !isPaidInSelectedMonth(item)).length} lançamentos a confirmar</small></article>
            <article className="metric-card"><div className="metric-icon green"><CircleDollarSign /></div><span>Já realizado</span><strong>{money(paidExpenseTotal, hidden)}</strong><small>{expenseTotal ? Math.round((paidExpenseTotal / expenseTotal) * 100) : 0}% das despesas do mês</small></article>
            <article className="metric-card"><div className="metric-icon orange"><PiggyBank /></div><span>Taxa de sobra</span><strong>{savingsRate.toFixed(0)}%</strong><small>do total de entradas previstas</small></article>
            <article className="metric-card"><div className="metric-icon blue"><BarChart3 /></div><span>Maior categoria</span><strong className="metric-name">{categoryTotals[0]?.name || 'Sem gastos'}</strong><small>{categoryTotals[0] ? money(categoryTotals[0].total, hidden) : 'Comece adicionando um lançamento'}</small></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel spending-panel"><div className="panel-head"><div><span className="eyebrow">Análise do mês</span><h2>Para onde vai o dinheiro</h2></div><button className="text-button" onClick={() => setTab('transactions')}>Ver lançamentos <ArrowRight size={15} /></button></div>
              {categoryTotals.length ? <div className="category-analysis"><div className="donut" style={{ background: `conic-gradient(${categoryTotals.map((item, index) => `${item.color} ${categoryTotals.slice(0, index).reduce((sum, row) => sum + row.total, 0) / expenseTotal * 100}% ${categoryTotals.slice(0, index + 1).reduce((sum, row) => sum + row.total, 0) / expenseTotal * 100}%`).join(',')})` }}><div><b>{hidden ? '•••' : Math.round(expenseTotal / Math.max(incomeTotal, 1) * 100)}%</b><span>da renda</span></div></div><div className="category-list">{categoryTotals.slice(0, 5).map(item => <div key={item.id}><i style={{ background: item.color }} /><span>{item.name}</span><b>{money(item.total, hidden)}</b><small>{Math.round(item.total / expenseTotal * 100)}%</small></div>)}</div></div> : <EmptyState icon={<BarChart3 />} title="Seu gráfico aparecerá aqui" text="Adicione despesas para entender seus hábitos no mês." />}
            </article>

            <article className="panel"><div className="panel-head"><div><span className="eyebrow">Próximos passos</span><h2>Contas pendentes</h2></div><BellRing size={19} /></div>
              <div className="upcoming-list">{monthlyExpenses.filter(item => !isPaidInSelectedMonth(item)).sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(0, 5).map(item => <button key={item.id} onClick={() => togglePaid(item)}><div className="date-box"><b>{new Date(item.date).getDate()}</b><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(item.date))}</span></div><div><b>{item.name}</b><span>{item.type === 'FIXED' ? 'Recorrente' : 'Pendente'}</span></div><strong>{money(item.amount, hidden)}</strong><span className="check-circle"><Check /></span></button>)}</div>
              {!monthlyExpenses.some(item => !isPaidInSelectedMonth(item)) && <EmptyState icon={<Check />} title="Tudo em dia" text="Não há despesas pendentes neste mês." />}
            </article>
          </section>
        </>}

        {tab === 'transactions' && <section className="page-section">
          <div className="page-title"><div><span className="eyebrow">Movimentações</span><h1>Lançamentos</h1><p>Encontre, edite e confirme tudo o que entrou ou saiu.</p></div><button className="primary-button" onClick={() => { setEditingTransaction(null); setTransactionModal(true); }}><Plus size={18} /> Novo lançamento</button></div>
          <div className="filter-bar"><div className="search-box"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por descrição, nota ou tag" /></div><select value={kindFilter} onChange={event => setKindFilter(event.target.value as any)}><option value="ALL">Entradas e saídas</option><option value="EXPENSE">Só despesas</option><option value="INCOME">Só receitas</option></select><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="ALL">Todas as categorias</option>{CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="transaction-summary"><span><ArrowUpRight /> Receitas <b>{money(incomeTotal, hidden)}</b></span><span><ArrowDownRight /> Despesas <b>{money(expenseTotal, hidden)}</b></span><span><CircleDollarSign /> Resultado <b className={projectedBalance >= 0 ? 'green-text' : 'red-text'}>{money(projectedBalance, hidden)}</b></span></div>
          <div className="transaction-table"><div className="table-head"><span>Lançamento</span><span>Categoria</span><span>Data</span><span>Status</span><span>Valor</span><span /></div>{visibleTransactions.map(item => {
            const isExpense = (item.kind || 'EXPENSE') === 'EXPENSE';
            const category = isExpense ? CATEGORIES.find(row => row.id === item.category) : INCOME_CATEGORIES.find(row => row.id === item.category);
            const paid = isPaidInSelectedMonth(item);
            return <div className="transaction-row" key={item.id}><div className={`transaction-icon ${isExpense ? 'expense' : 'income'}`}>{isExpense ? <ArrowDownRight /> : <ArrowUpRight />}</div><div className="transaction-name"><b>{item.name}</b><span>{item.type === 'FIXED' ? 'Recorrente' : item.type === 'INSTALLMENT' ? `Parcela ${item.currentInstallment}/${item.installmentsCount}` : PAYMENT_METHODS.find(method => method.id === item.paymentMethod)?.name || 'Lançamento'}</span></div><span className="category-chip">{category?.name || 'Outros'}</span><span className="transaction-date">{shortDate(item.date)}</span><button className={`status-chip ${paid ? 'paid' : 'pending'}`} onClick={() => togglePaid(item)}>{paid ? <Check /> : <span />}{paid ? 'Confirmado' : 'Pendente'}</button><strong className={isExpense ? '' : 'green-text'}>{isExpense ? '- ' : '+ '}{money(item.amount, hidden)}</strong><div className="row-actions"><button onClick={() => { setEditingTransaction(item); setTransactionModal(true); }} aria-label="Editar"><Pencil /></button><button onClick={() => removeTransaction(item)} aria-label="Excluir"><Trash2 /></button></div></div>;
          })}</div>
          {!visibleTransactions.length && <EmptyState icon={<Receipt />} title="Nenhum lançamento encontrado" text={search || kindFilter !== 'ALL' || categoryFilter !== 'ALL' ? 'Tente remover algum filtro.' : 'Adicione a primeira movimentação deste mês.'} action={<button className="primary-button" onClick={() => setTransactionModal(true)}><Plus size={18} /> Adicionar</button>} />}
        </section>}

        {tab === 'planning' && <section className="page-section">
          <div className="page-title"><div><span className="eyebrow">Planos e escolhas</span><h1>Planejamento</h1><p>Defina limites realistas e transforme intenção em progresso.</p></div><div className="button-group"><button className="soft-button" onClick={() => setBudgetModal(true)}><Plus size={17} /> Limite</button><button className="primary-button" onClick={() => setGoalModal(true)}><Plus size={17} /> Nova meta</button></div></div>
          <div className="planning-grid"><article className="panel"><div className="panel-head"><div><span className="eyebrow">Orçamento mensal</span><h2>Limites por categoria</h2></div><button className="icon-button" onClick={() => setBudgetModal(true)}><Plus /></button></div><div className="budget-list">{budgets.map(budget => {
            const category = CATEGORIES.find(item => item.id === budget.category) || CATEGORIES[CATEGORIES.length - 1];
            const spent = monthlyExpenses.filter(item => item.category === budget.category).reduce((sum, item) => sum + item.amount, 0);
            const percentage = budget.amount ? spent / budget.amount * 100 : 0;
            return <div className="budget-item" key={budget.id}><div><i style={{ background: category.color }} /><b>{category.name}</b><span>{money(spent, hidden)} de {money(budget.amount, hidden)}</span><button onClick={() => save({ budgets: budgets.filter(item => item.id !== budget.id) })}><Trash2 /></button></div><Progress value={percentage} color={percentage > 100 ? '#dc2626' : category.color} /><small className={percentage > 100 ? 'red-text' : ''}>{percentage > 100 ? `${money(spent - budget.amount, hidden)} acima do limite` : `${money(Math.max(0, budget.amount - spent), hidden)} disponível`}</small></div>;
          })}</div>{!budgets.length && <EmptyState icon={<BarChart3 />} title="Planeje sem complicação" text="Crie limites para as categorias que mais pesam no seu orçamento." action={<button className="soft-button" onClick={() => setBudgetModal(true)}>Criar primeiro limite</button>} />}</article>
          <article className="panel planning-insight"><Sparkles /><span className="eyebrow">Leitura do mês</span><h2>{projectedBalance >= 0 ? 'Você está no caminho certo.' : 'O mês precisa de um ajuste.'}</h2><p>{projectedBalance >= 0 ? `Após gastos e metas, a projeção indica uma sobra de ${money(projectedBalance, hidden)}.` : `As saídas superam as entradas em ${money(Math.abs(projectedBalance), hidden)}. Comece revisando ${categoryTotals[0]?.name || 'os maiores gastos'}.`}</p><div><span>Comprometimento da renda</span><b>{incomeTotal ? Math.round((expenseTotal + monthlyGoalTotal) / incomeTotal * 100) : 0}%</b></div><Progress value={incomeTotal ? (expenseTotal + monthlyGoalTotal) / incomeTotal * 100 : 0} color={projectedBalance >= 0 ? '#059669' : '#dc2626'} /></article></div>
          <div className="section-heading"><div><span className="eyebrow">Seus objetivos</span><h2>Metas financeiras</h2></div></div>
          <div className="goals-grid">{goals.map(goal => {
            const percentage = goal.targetAmount ? goal.currentAmount / goal.targetAmount * 100 : 0;
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
            const months = goal.monthlyAmount ? Math.ceil(remaining / goal.monthlyAmount) : 0;
            return <article className="goal-card" key={goal.id}><div className="goal-top"><div className="goal-icon" style={{ background: `${goal.color || GOAL_COLORS[0]}18`, color: goal.color || GOAL_COLORS[0] }}><Target /></div><button onClick={() => window.confirm('Excluir esta meta?') && save({ goals: goals.filter(item => item.id !== goal.id) })}><Trash2 /></button></div><span className="eyebrow">{goal.deadline ? `Até ${new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(`${goal.deadline}T12:00:00`))}` : 'Objetivo financeiro'}</span><h3>{goal.name}</h3><div className="goal-values"><strong>{money(goal.currentAmount, hidden)}</strong><span>de {money(goal.targetAmount, hidden)}</span></div><Progress value={percentage} color={goal.color || GOAL_COLORS[0]} /><div className="goal-foot"><span>{Math.round(percentage)}% concluído</span><span>{months ? `~${months} meses` : money(remaining, hidden) + ' restantes'}</span></div><button className="soft-button wide" onClick={() => setContributionGoal(goal)}><Plus size={17} /> Registrar aporte</button></article>;
          })}</div>
          {!goals.length && <EmptyState icon={<Target />} title="Dê um nome aos seus planos" text="Reserva de emergência, viagem ou um novo projeto: acompanhe cada conquista." action={<button className="primary-button" onClick={() => setGoalModal(true)}>Criar primeira meta</button>} />}
        </section>}

        {tab === 'settings' && <section className="page-section settings-page">
          <div className="page-title"><div><span className="eyebrow">Personalização e dados</span><h1>Ajustes</h1><p>Configure o DuoFinance para a sua rotina.</p></div></div>
          <div className="settings-grid"><article className="panel"><div className="panel-head"><div><span className="eyebrow">Seu espaço</span><h2>Perfil de uso</h2></div><UserIcon /></div><form className="form-grid" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); save({ settings: { ...settings, householdName: String(form.get('householdName')), responsibleName: String(form.get('responsibleName')), mode: String(form.get('mode')) } }, 'Perfil atualizado.'); }}><Field label="Nome do espaço"><input name="householdName" defaultValue={settings.householdName} required placeholder="Ex: Casa Silva" /></Field><Field label="Responsável pelos lançamentos"><input name="responsibleName" defaultValue={profileName} required /></Field><Field label="Como você usa o app?" className="full"><select name="mode" defaultValue={settings.mode}><option value="INDIVIDUAL">Controle individual</option><option value="HOUSEHOLD">Controle da casa / casal</option></select></Field><button className="primary-button" type="submit">Salvar perfil</button></form></article>
          <article className="panel"><div className="panel-head"><div><span className="eyebrow">Entradas recorrentes</span><h2>Receitas mensais</h2></div><button className="icon-button" onClick={() => setIncomeModal('new')}><Plus /></button></div><div className="income-list">{incomes.map(income => <div key={income.id}><div className="metric-icon green"><ArrowUpRight /></div><div><b>{income.name}</b><span>Todo dia {income.day}</span></div><strong>{money(income.amount, hidden)}</strong><button onClick={() => setIncomeModal(income)}><Pencil /></button><button onClick={() => window.confirm('Excluir esta receita mensal?') && save({ incomes: incomes.filter(item => item.id !== income.id) })}><Trash2 /></button></div>)}</div>{!incomes.length && <EmptyState icon={<CircleDollarSign />} title="Cadastre sua renda" text="Salários e outras entradas recorrentes entram automaticamente na projeção mensal." />}<button className="soft-button wide" onClick={() => setIncomeModal('new')}><Plus size={17} /> Adicionar receita mensal</button></article>
          <article className="panel"><div className="panel-head"><div><span className="eyebrow">Portabilidade</span><h2>Seus dados</h2></div><ShieldCheck /></div><p className="panel-copy">Mantenha uma cópia dos dados ou leve seus lançamentos para uma planilha.</p><div className="data-actions"><button onClick={exportBackup}><Download /> Baixar backup <span>Arquivo completo .json</span></button><button onClick={exportCsv}><FileDown /> Exportar planilha <span>Lançamentos em .csv</span></button><button onClick={() => importRef.current?.click()}><ArrowUpRight /> Restaurar backup <span>Substitui os dados atuais</span></button><input ref={importRef} hidden type="file" accept="application/json" onChange={importBackup} /></div></article>
          <article className="panel"><div className="panel-head"><div><span className="eyebrow">Aplicativo</span><h2>Preferências</h2></div><Settings /></div><div className="preference-list"><button onClick={() => save({ settings: { ...settings, hideValues: !hidden } })}><div>{hidden ? <EyeOff /> : <Eye />}<span><b>Privacidade dos valores</b><small>{hidden ? 'Valores ocultos' : 'Valores visíveis'}</small></span></div><i className={`switch ${hidden ? 'on' : ''}`} /></button>{!standalone && <button onClick={installApp}><div><Smartphone /><span><b>Instalar DuoFinance</b><small>Acesso rápido na tela inicial</small></span></div><ArrowRight /></button>}<div className="version"><span>Versão 2.0</span><span>Sincronização ativa</span></div></div></article></div>
        </section>}
      </main>
    </div>

    <nav className="bottom-nav">{navItems.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.icon}<span>{item.label.split(' ')[0]}</span></button>)}</nav>

    {transactionModal && <TransactionModal transaction={editingTransaction} onClose={() => { setTransactionModal(false); setEditingTransaction(null); }} onSubmit={submitTransaction} />}
    {goalModal && <Modal title="Nova meta financeira" subtitle="Transforme um plano em um valor alcançável." onClose={() => setGoalModal(false)}><form className="form-grid" onSubmit={submitGoal}><Field label="Nome da meta" className="full"><input name="name" required placeholder="Ex: Reserva de emergência" /></Field><Field label="Valor desejado"><input name="target" type="number" min="0.01" step="0.01" required placeholder="R$ 0,00" /></Field><Field label="Já tenho"><input name="current" type="number" min="0" step="0.01" placeholder="R$ 0,00" /></Field><Field label="Aporte mensal"><input name="monthly" type="number" min="0" step="0.01" placeholder="R$ 0,00" /></Field><Field label="Prazo desejado"><input name="deadline" type="date" /></Field><Field label="Cor" className="full"><div className="color-picker">{GOAL_COLORS.map((color, index) => <label key={color}><input type="radio" name="color" value={color} defaultChecked={index === 0} /><i style={{ background: color }} /></label>)}</div></Field><div className="modal-actions full"><button type="button" className="ghost-button" onClick={() => setGoalModal(false)}>Cancelar</button><button className="primary-button" type="submit">Criar meta</button></div></form></Modal>}
    {contributionGoal && <Modal title="Registrar aporte" subtitle={contributionGoal.name} onClose={() => setContributionGoal(null)}><form className="form-stack" onSubmit={addContribution}><div className="contribution-summary"><span>Acumulado atual</span><strong>{money(contributionGoal.currentAmount, hidden)}</strong><Progress value={contributionGoal.currentAmount / contributionGoal.targetAmount * 100} color={contributionGoal.color} /></div><Field label="Valor do aporte"><input name="amount" autoFocus type="number" min="0.01" max={Math.max(0.01, contributionGoal.targetAmount - contributionGoal.currentAmount)} step="0.01" required placeholder="R$ 0,00" /></Field><button className="primary-button wide" type="submit">Confirmar aporte</button></form></Modal>}
    {budgetModal && <Modal title="Limite por categoria" subtitle="Defina quanto pretende gastar por mês." onClose={() => setBudgetModal(false)}><form className="form-stack" onSubmit={submitBudget}><Field label="Categoria"><select name="category" required>{CATEGORIES.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></Field><Field label="Limite mensal"><input name="amount" type="number" min="0.01" step="0.01" required placeholder="R$ 0,00" /></Field><button className="primary-button wide" type="submit">Salvar limite</button></form></Modal>}
    {incomeModal && <Modal title={incomeModal === 'new' ? 'Nova receita mensal' : 'Editar receita mensal'} subtitle="Ela será considerada em todos os meses." onClose={() => setIncomeModal(null)}><form className="form-stack" onSubmit={submitIncome}><Field label="Descrição"><input name="name" required defaultValue={incomeModal === 'new' ? '' : incomeModal.name} placeholder="Ex: Salário" /></Field><div className="form-grid"><Field label="Valor líquido"><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={incomeModal === 'new' ? '' : incomeModal.amount} /></Field><Field label="Dia do recebimento"><input name="day" type="number" min="1" max="31" required defaultValue={incomeModal === 'new' ? 5 : incomeModal.day} /></Field></div><button className="primary-button wide" type="submit">Salvar receita</button></form></Modal>}
    {installHelp && <Modal title="Instale o DuoFinance" subtitle="Tenha acesso rápido como um aplicativo." onClose={() => setInstallHelp(false)}><div className="install-steps"><div><b>1</b><span>No navegador, abra o menu de compartilhamento ou os três pontos.</span></div><div><b>2</b><span>Escolha “Adicionar à tela de início” ou “Instalar aplicativo”.</span></div><div><b>3</b><span>Confirme para criar o atalho no seu celular ou computador.</span></div></div><button className="primary-button wide" onClick={() => setInstallHelp(false)}>Entendi</button></Modal>}
    {toast && <Toast toast={toast} />}
  </div>;
}

function TransactionModal({ transaction, onClose, onSubmit }: {
  transaction: Transaction | null; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind || 'EXPENSE');
  const [type, setType] = useState<TransactionType>(transaction?.type || 'VARIABLE');
  return <Modal title={transaction ? 'Editar lançamento' : 'Novo lançamento'} subtitle="Registre em poucos segundos. Você pode editar depois." onClose={onClose}><form className="form-grid transaction-form" onSubmit={onSubmit}><div className="segmented full"><label><input type="radio" name="kind" value="EXPENSE" checked={kind === 'EXPENSE'} onChange={() => setKind('EXPENSE')} /><span><ArrowDownRight /> Despesa</span></label><label><input type="radio" name="kind" value="INCOME" checked={kind === 'INCOME'} onChange={() => { setKind('INCOME'); setType('VARIABLE'); }} /><span><ArrowUpRight /> Receita extra</span></label></div><Field label="Descrição" className="full"><input name="name" required defaultValue={transaction?.name.replace(/ \(\d+\/\d+\)$/, '')} placeholder={kind === 'EXPENSE' ? 'Ex: Supermercado' : 'Ex: Trabalho extra'} autoFocus /></Field><Field label="Valor"><input name="amount" type="number" min="0.01" step="0.01" required defaultValue={transaction?.amount} placeholder="R$ 0,00" /></Field><Field label="Data"><input name="date" type="date" required defaultValue={transaction ? transaction.date.slice(0, 10) : dateInputValue()} /></Field><Field label="Categoria"><select name="category" defaultValue={transaction?.category}>{(kind === 'EXPENSE' ? CATEGORIES : INCOME_CATEGORIES).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Forma de pagamento"><select name="paymentMethod" defaultValue={transaction?.paymentMethod || 'PIX'} disabled={kind === 'INCOME'}>{PAYMENT_METHODS.map(method => <option key={method.id} value={method.id}>{method.name}</option>)}</select></Field>{kind === 'EXPENSE' && <Field label="Frequência" className="full"><div className="type-options">{([['VARIABLE', 'Única'], ['FIXED', 'Recorrente'], ['INSTALLMENT', 'Parcelada']] as const).map(option => <label key={option[0]}><input type="radio" name="type" value={option[0]} checked={type === option[0]} disabled={Boolean(transaction?.parentId)} onChange={() => setType(option[0])} /><span>{option[0] === 'FIXED' && <Repeat2 />}{option[1]}</span></label>)}</div></Field>}{kind === 'INCOME' && <input type="hidden" name="type" value="VARIABLE" />}{type === 'INSTALLMENT' && !transaction && <Field label="Quantidade de parcelas" hint="O valor total será dividido" className="full"><input name="installments" type="number" min="2" max="120" defaultValue="2" required /></Field>}<Field label="Tags" hint="Separe por vírgula" className="full"><input name="tags" defaultValue={transaction?.tags?.join(', ')} placeholder="Ex: essencial, trabalho" /></Field><Field label="Observações" className="full"><textarea name="notes" defaultValue={transaction?.notes} rows={3} placeholder="Detalhes opcionais" /></Field><label className="check-field full"><input name="isPaid" type="checkbox" defaultChecked={transaction?.isPaid} /><span><Check /> Já foi {kind === 'EXPENSE' ? 'pago' : 'recebido'}</span></label><div className="modal-actions full"><button type="button" className="ghost-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">{transaction ? 'Salvar alterações' : 'Adicionar lançamento'}</button></div></form></Modal>;
}

function Toast({ toast }: { toast: Exclude<ToastState, null> }) {
  return <div className={`toast ${toast.tone === 'error' ? 'error' : ''}`}>{toast.tone === 'error' ? <X /> : <Check />}<span>{toast.message}</span></div>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
