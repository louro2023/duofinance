import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { 
  User, 
  Income, 
  Transaction, 
  SavingsGoal 
} from './types.ts';
import { CATEGORIES } from './constants.tsx';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  CreditCard, 
  LogOut, 
  Trash2, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Target, 
  Settings, 
  X, 
  Zap, 
  Loader2, 
  TrendingUp,
  Download,
  Share,
  PlusSquare,
  Info,
  Smartphone,
  AppWindow
} from 'lucide-react';

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyD4MW7KAeVC3h73G0tnGxb9RzQsJ-o6Mco",
  authDomain: "duofinance-5b1d8.firebaseapp.com",
  projectId: "duofinance-5b1d8",
  storageBucket: "duofinance-5b1d8.firebasestorage.app",
  messagingSenderId: "1031506294790",
  appId: "1:1031506294790:web:d9c9851a48ec0ded616b87",
  databaseURL: "https://duofinance-5b1d8-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const DB_PATH = "projects/duofinance";

// --- Utils ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getMonthKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthName = (date: Date) => {
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const ensureArray = (data: any) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
};

const Card: React.FC<{ children?: React.ReactNode, title?: string, className?: string, icon?: React.ReactNode }> = ({ children, title, className = "", icon }) => (
  <div className={`bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex flex-col min-h-[152px] ${className}`}>
    <div className="flex items-center gap-1.5 mb-4">
      {icon && <span className="text-gray-300 scale-90">{icon}</span>}
      {title && <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[1.5px] leading-none">{title}</h3>}
    </div>
    <div className="flex flex-col justify-center flex-grow">
      {children}
    </div>
  </div>
);

const ProgressBar = ({ progress, color = "bg-blue-500" }: { progress: number, color?: string }) => (
  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
    <div 
      className={`h-full ${color} transition-all duration-500 ease-out`} 
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);

const App = () => {
  // --- State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [coupleName, setCoupleName] = useState('DuoFinance');
  const [rememberMe, setRememberMe] = useState(false);

  // PWA States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPWAInstruction, setShowPWAInstruction] = useState(false);

  // Financial Data
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'goals' | 'settings'>('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    const savedUser = localStorage.getItem('duofinance_user');
    if (savedUser) setIsLoggedIn(true);

    const dataRef = ref(db, DB_PATH);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fetchedIncomes = ensureArray(data.incomes);
        const fetchedTransactions = ensureArray(data.transactions);
        const fetchedGoals = ensureArray(data.goals);
        const fetchedUsers = ensureArray(data.users);

        setIncomes(fetchedIncomes);
        setTransactions(fetchedTransactions);
        setGoals(fetchedGoals);
        setUsers(fetchedUsers);
        
        if (fetchedUsers.length >= 2) {
          setCoupleName(`${fetchedUsers[0].name} e ${fetchedUsers[1].name}`);
        } else if (fetchedUsers.length === 1) {
          setCoupleName(fetchedUsers[0].name);
        }
      }
      setIsLoadingData(false);
    }, (error) => {
      console.error("Firebase sync error:", error);
      setIsLoadingData(false);
    });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(!!checkStandalone);
    
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const saveToFirebase = (updates: { incomes?: Income[], transactions?: Transaction[], goals?: SavingsGoal[], users?: User[] }) => {
    const dataRef = ref(db, DB_PATH);
    set(dataRef, {
      incomes: updates.incomes ?? incomes,
      transactions: updates.transactions ?? transactions,
      goals: updates.goals ?? goals,
      users: updates.users ?? users
    });
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const validUser = users.find(u => u.email === email && u.password === password);
    
    if (validUser || (users.length === 0 && email && password)) {
      setIsLoggedIn(true);
      if (rememberMe) {
        localStorage.setItem('duofinance_user', 'true');
      }
    } else {
      alert("Credenciais inválidas");
    }
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback para iOS ou Desktop (mostra instruções)
      setShowPWAInstruction(true);
    }
  };

  const currentMonthKey = getMonthKey(selectedMonth);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (t.type === 'VARIABLE' || t.type === 'INSTALLMENT') {
        return getMonthKey(tDate) === currentMonthKey;
      }
      if (t.type === 'FIXED') {
        return getMonthKey(tDate) <= currentMonthKey;
      }
      return false;
    });
  }, [transactions, currentMonthKey]);

  const totalGoalMonthlyContributions = useMemo(() => {
    return goals
      .filter(g => g.currentAmount < g.targetAmount)
      .reduce((sum, g) => sum + (g.monthlyAmount || 0), 0);
  }, [goals]);

  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const transactionSum = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactionSum + totalGoalMonthlyContributions;

  const handleAddTransaction = (newT: Partial<Transaction>) => {
    let updatedTransactions = [...transactions];
    if (newT.type === 'INSTALLMENT' && newT.installmentsCount && newT.installmentsCount > 1) {
      const baseAmount = newT.amount! / newT.installmentsCount;
      const parentId = Math.random().toString(36).substr(2, 9);
      for (let i = 0; i < newT.installmentsCount; i++) {
        const d = new Date(newT.date!);
        d.setMonth(d.getMonth() + i);
        updatedTransactions.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: '1',
          name: `${newT.name} (${i + 1}/${newT.installmentsCount})`,
          amount: baseAmount,
          category: newT.category!,
          date: d.toISOString(),
          type: 'INSTALLMENT',
          paymentMethod: 'CREDIT',
          installmentsCount: newT.installmentsCount,
          currentInstallment: i + 1,
          parentId,
          isPaid: false
        } as Transaction);
      }
    } else {
      updatedTransactions.push({
        id: Math.random().toString(36).substr(2, 9),
        userId: '1',
        name: newT.name!,
        amount: newT.amount!,
        category: newT.category!,
        date: newT.date!,
        type: newT.type!,
        paymentMethod: newT.paymentMethod,
        isPaid: false
      } as Transaction);
    }
    saveToFirebase({ transactions: updatedTransactions });
    setShowAddModal(false);
  };

  const deleteTransaction = (id: string) => {
    saveToFirebase({ transactions: transactions.filter(t => t.id !== id) });
  };

  // UI Component: PWA Instructions Modal
  const PWAInstructions = () => (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center animate-in fade-in duration-300 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom duration-500">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg"><Smartphone size={20} className="text-gray-600" /></div>
            <h3 className="font-bold text-gray-900">Como Baixar DuoFinance</h3>
          </div>
          <button onClick={() => setShowPWAInstruction(false)} className="p-2 text-gray-400"><X size={24} /></button>
        </div>
        
        <div className="space-y-6">
          <p className="text-sm text-gray-500 mb-4">Para ter a melhor experiência e acesso offline, adicione o app à sua tela de início:</p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shrink-0">1</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {isIOS ? (
                  <>No Safari, toque no ícone de <span className="inline-flex items-center justify-center p-1 bg-gray-100 rounded"><Share size={14} /></span> <b>Compartilhar</b>.</>
                ) : (
                  <>No Chrome, toque nos <b>três pontos</b> <span className="font-bold">⋮</span> no canto superior.</>
                )}
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shrink-0">2</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Procure e selecione <span className="inline-flex items-center justify-center p-1 bg-gray-100 rounded">
                  {isIOS ? <PlusSquare size={14} /> : <Download size={14} />}
                </span> <b>Adicionar à Tela de Início</b> ou <b>Instalar Aplicativo</b>.
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shrink-0">3</div>
              <p className="text-sm text-gray-600 leading-relaxed">Toque em <b>Adicionar</b> ou <b>Instalar</b> no canto superior direito.</p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowPWAInstruction(false)} className="w-full mt-8 bg-black text-white font-bold py-4 rounded-2xl active:scale-95 transition-all">Entendi</button>
      </div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f5f5f7]">
        <div className="w-full max-w-md bg-white rounded-[32px] p-10 shadow-xl border border-gray-100">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <Wallet className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">DuoFinance</h1>
            <p className="text-gray-400 mt-3 text-center text-sm leading-relaxed max-w-[280px]">
              Organize o futuro das suas finanças com elegância e simplicidade. 
              <span className="block mt-1 font-medium text-black">Transforme sua vida financeira.</span>
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="email" type="email" required className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-black/5 transition-all font-medium text-gray-800" placeholder="E-mail" />
            <input name="password" type="password" required className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-black/5 transition-all font-medium text-gray-800" placeholder="Senha" />
            
            <div className="flex items-center gap-3 px-1 pb-2">
              <input 
                type="checkbox" 
                id="remember" 
                className="w-5 h-5 rounded-lg border-gray-200 text-black focus:ring-0 accent-black"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember" className="text-[13px] font-bold text-gray-500 cursor-pointer">Manter conectado</label>
            </div>

            <button className="w-full bg-black text-white font-bold py-5 rounded-[24px] shadow-2xl hover:bg-gray-900 transition-all active:scale-95 text-sm uppercase tracking-widest mt-4">Acessar Painel</button>
          </form>
          
          {!isStandalone && (
            <button 
              onClick={handleInstallPWA}
              className="w-full mt-6 flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-bold text-[11px] uppercase tracking-widest hover:border-black hover:text-black transition-all"
            >
              <Download size={16} /> Baixar no Celular
            </button>
          )}
        </div>

        {showPWAInstruction && <PWAInstructions />}
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f7]">
        <Loader2 className="animate-spin text-black mb-4" size={40} />
        <p className="text-gray-500 font-medium">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="pb-32 max-w-lg mx-auto min-h-screen flex flex-col font-sans">
      <header className="px-6 pt-6 pb-2 sticky top-0 bg-[#f5f5f7]/80 apple-blur z-20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <Wallet className="text-white w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[1px] mb-0.5">DuoFinance</p>
              <h2 className="font-bold text-[18px] text-gray-900 leading-none">{coupleName}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isStandalone && (
              <button onClick={handleInstallPWA} title="Baixar App" className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                <Smartphone size={20} />
              </button>
            )}
            <button onClick={() => { setIsLoggedIn(false); localStorage.removeItem('duofinance_user'); }} className="p-2 text-gray-400 hover:text-black transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white rounded-full p-1 shadow-sm border border-gray-100 mb-6">
          <button onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="font-bold text-[13px] text-gray-900 tracking-tight">{getMonthName(selectedMonth)}</span>
          <button onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </header>

      <main className="px-6 space-y-6 flex-1">
        {activeTab === 'dashboard' && (
          <>
            {/* Atalho de Instalação Visível no Dashboard */}
            {!isStandalone && (
              <div onClick={handleInstallPWA} className="cursor-pointer animate-fade-in bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[28px] p-5 flex items-center justify-between mb-2 shadow-lg shadow-blue-200 group active:scale-[0.98] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                    <Download size={24} />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-white leading-tight">DuoFinance no Celular</h4>
                    <p className="text-[11px] text-white/70 font-medium">Instale agora para acesso rápido</p>
                  </div>
                </div>
                <div className="bg-white text-blue-600 p-2 rounded-full shadow-sm group-hover:translate-x-1 transition-transform">
                  <ChevronRight size={18} />
                </div>
              </div>
            )}

            <div className="bg-black text-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-1/2 -right-10 -translate-y-1/2 opacity-10 rotate-12"><TrendingUp size={160} /></div>
              <p className="text-gray-400 text-center text-[10px] font-bold uppercase tracking-[3.5px] mb-8 relative z-10">Saldo Disponível</p>
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-white/10 rounded-3xl p-5 backdrop-blur-md border border-white/5 h-[100px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2 text-emerald-400">
                    <ArrowUpRight size={14} /><span className="text-[9px] font-bold uppercase">Entradas</span>
                  </div>
                  <p className="font-bold text-[18px]">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="bg-white/10 rounded-3xl p-5 backdrop-blur-md border border-white/5 h-[100px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2 text-red-400">
                    <ArrowDownRight size={14} /><span className="text-[9px] font-bold uppercase">Saídas</span>
                  </div>
                  <p className="font-bold text-[18px]">{formatCurrency(totalExpenses)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <Card title="Saldo Projetado" icon={<Zap size={13} />}>
                  <p className="text-[20px] font-bold text-gray-900 tracking-tight">{formatCurrency(totalIncome - totalExpenses)}</p>
               </Card>
               <Card title="Metas do Mês" icon={<Target size={13} />}>
                  <p className="text-[20px] font-bold text-blue-600 tracking-tight">{formatCurrency(totalGoalMonthlyContributions)}</p>
               </Card>
            </div>

            {goals.length > 0 && (
              <Card title="Progresso de Sonhos" icon={<Target size={14} />}>
                <div className="space-y-5 py-2">
                  {goals.map(goal => (
                    <div key={goal.id}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-bold text-[13px] text-gray-800">{goal.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                      </div>
                      <ProgressBar progress={(goal.currentAmount / goal.targetAmount) * 100} color="bg-emerald-500" />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-3">
             <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Lançamentos</h3>
             {filteredTransactions.map(t => {
               const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[CATEGORIES.length-1];
               return (
                 <div key={t.id} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center gap-4 group shadow-sm">
                   <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: cat.color + '15' }}>{cat.icon}</div>
                   <div className="flex-1">
                     <h4 className="font-bold text-[14px] text-gray-800">{t.name}</h4>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{cat.name} • {t.type}</p>
                   </div>
                   <div className="text-right">
                     <p className="font-bold text-[14px] text-gray-900">-{formatCurrency(t.amount)}</p>
                     <button onClick={() => deleteTransaction(t.id)} className="text-gray-300 hover:text-red-500 mt-1"><Trash2 size={14} /></button>
                   </div>
                 </div>
               );
             })}
             {filteredTransactions.length === 0 && <p className="text-center py-20 text-gray-400 font-medium">Nenhum gasto este mês.</p>}
          </div>
        )}

        {activeTab === 'goals' && (
           <div className="space-y-4">
             <div className="flex justify-between items-center mb-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Metas</h3>
                <button onClick={() => setShowGoalModal(true)} className="bg-black text-white p-2.5 rounded-2xl"><Plus size={20} /></button>
             </div>
             {goals.map(goal => (
               <Card key={goal.id}>
                 <div className="flex justify-between items-start mb-4">
                   <h4 className="font-bold text-gray-900">{goal.name}</h4>
                   <span className="text-[9px] bg-gray-50 px-2 py-1 rounded-full text-gray-400 font-bold uppercase tracking-widest">{formatCurrency(goal.targetAmount)}</span>
                 </div>
                 <ProgressBar progress={(goal.currentAmount / goal.targetAmount) * 100} color="bg-emerald-500" />
                 <div className="flex gap-2 mt-6">
                   <button onClick={() => { setEditingGoalId(goal.id); setShowContributionModal(true); }} className="flex-1 bg-gray-50 text-gray-900 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest">Aporte Extra</button>
                   <button onClick={() => saveToFirebase({ goals: goals.filter(g => g.id !== goal.id) })} className="p-2 text-gray-200 hover:text-red-500"><Trash2 size={18} /></button>
                 </div>
               </Card>
             ))}
           </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
               <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[2px] mb-4">Receitas Mensais</h3>
               <div className="space-y-4">
                 {incomes.map(inc => (
                   <div key={inc.id} className="flex justify-between items-center">
                     <span className="font-bold text-gray-800">{inc.name}</span>
                     <div className="flex items-center gap-3">
                       <span className="font-bold text-emerald-600">{formatCurrency(inc.amount)}</span>
                       <button onClick={() => saveToFirebase({ incomes: incomes.filter(i => i.id !== inc.id) })} className="text-gray-300"><Trash2 size={16} /></button>
                     </div>
                   </div>
                 ))}
                 <button onClick={() => setShowIncomeModal(true)} className="w-full mt-2 py-3 border border-dashed border-gray-200 rounded-2xl text-[10px] font-bold text-gray-400 uppercase tracking-widest">+ Adicionar Renda</button>
               </div>
            </div>

            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
               <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-[2px] mb-4">Configuração App</h3>
               <div className="space-y-4">
                 {!isStandalone && (
                   <button 
                     onClick={handleInstallPWA}
                     className="w-full flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-2xl active:scale-95 transition-all mb-2"
                   >
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-600 rounded-xl text-white shadow-sm">
                         <Download size={18} />
                       </div>
                       <div className="text-left">
                         <span className="font-bold text-gray-800 text-[13px] block">Instalar no Celular</span>
                         <span className="text-[10px] text-gray-500">Adicionar à tela inicial</span>
                       </div>
                     </div>
                     <ChevronRight size={16} className="text-gray-400" />
                   </button>
                 )}
                 <div className="p-4 bg-gray-50 rounded-2xl text-center">
                   <p className="text-[11px] text-gray-400 font-medium">Versão 1.2.0 (PWA)</p>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 apple-blur border-t border-gray-100 px-8 py-4 flex items-center justify-between z-30 max-w-lg mx-auto pb-10">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'dashboard' ? 'text-black' : 'text-gray-300'}`}>
          <LayoutDashboard size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Início</span>
        </button>
        <button onClick={() => setActiveTab('transactions')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'transactions' ? 'text-black' : 'text-gray-300'}`}>
          <CreditCard size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Extrato</span>
        </button>
        <button onClick={() => setShowAddModal(true)} className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-white shadow-2xl -mt-10 border-4 border-[#f5f5f7] active:scale-90 transition-all">
          <Plus size={28} />
        </button>
        <button onClick={() => setActiveTab('goals')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'goals' ? 'text-black' : 'text-gray-300'}`}>
          <Target size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Metas</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'settings' ? 'text-black' : 'text-gray-300'}`}>
          <Settings size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Ajustes</span>
        </button>
      </nav>

      {/* Modals */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Novo Gasto</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2"><X size={24} /></button>
             </div>
             <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               handleAddTransaction({
                 name: fd.get('name') as string,
                 amount: parseFloat(fd.get('amount') as string),
                 category: fd.get('category') as string,
                 type: 'VARIABLE',
                 date: new Date().toISOString()
               });
             }} className="space-y-4">
                <input name="name" required className="w-full p-4 bg-gray-50 rounded-2xl font-semibold outline-none" placeholder="Descrição" />
                <input name="amount" type="number" step="0.01" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none" placeholder="Valor R$" />
                <select name="category" className="w-full p-4 bg-gray-50 rounded-2xl font-semibold appearance-none outline-none">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <button className="w-full bg-black text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-all">Salvar</button>
             </form>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Nova Meta</h2>
                <button onClick={() => setShowGoalModal(false)} className="p-2"><X size={24} /></button>
             </div>
             <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               const name = fd.get('name') as string;
               const target = parseFloat(fd.get('target') as string);
               const monthly = parseFloat(fd.get('monthly') as string) || 0;
               if(name && target) {
                 saveToFirebase({ goals: [...goals, { id: Math.random().toString(36).substr(2, 9), name, targetAmount: target, currentAmount: 0, monthlyAmount: monthly, type: 'FIXED', value: target }] });
                 setShowGoalModal(false);
               }
             }} className="space-y-4">
                <input name="name" required className="w-full p-4 bg-gray-50 rounded-2xl font-semibold outline-none" placeholder="Qual o objetivo?" />
                <input name="target" type="number" step="0.01" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none" placeholder="Valor Total R$" />
                <input name="monthly" type="number" step="0.01" className="w-full p-4 bg-blue-50 text-blue-700 rounded-2xl font-bold outline-none" placeholder="Aporte Mensal R$" />
                <button className="w-full bg-black text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-all">Criar Meta</button>
             </form>
          </div>
        </div>
      )}

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <h2 className="text-xl font-bold mb-6">Adicionar Renda</h2>
             <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               const n = fd.get('name') as string;
               const a = parseFloat(fd.get('amount') as string);
               if(n && a) {
                 saveToFirebase({ incomes: [...incomes, { id: Math.random().toString(36).substr(2, 9), name: n, amount: a, day: 5, userId: '1' }] });
                 setShowIncomeModal(false);
               }
             }} className="space-y-4">
                <input name="name" required className="w-full p-4 bg-gray-50 rounded-2xl font-semibold outline-none" placeholder="Ex: Salário" />
                <input name="amount" type="number" step="0.01" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none" placeholder="R$ 0,00" />
                <button className="w-full bg-black text-white font-bold py-4 rounded-2xl active:scale-95 transition-all">Salvar</button>
                <button type="button" onClick={() => setShowIncomeModal(false)} className="w-full py-2 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
             </form>
          </div>
        </div>
      )}

      {/* Goal Contribution Modal */}
      {showContributionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <h2 className="text-xl font-bold mb-6">Aporte Extra</h2>
             <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               const val = parseFloat(fd.get('amount') as string);
               if(editingGoalId && val) {
                 const updatedGoals = goals.map(g => g.id === editingGoalId ? { ...g, currentAmount: g.currentAmount + val } : g);
                 saveToFirebase({ goals: updatedGoals });
                 setShowContributionModal(false);
                 setEditingGoalId(null);
               }
             }} className="space-y-4">
                <input name="amount" type="number" step="0.01" required className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xl outline-none" placeholder="Valor do Aporte R$" />
                <button className="w-full bg-black text-white font-bold py-4 rounded-2xl active:scale-95 transition-all">Confirmar Aporte</button>
                <button type="button" onClick={() => { setShowContributionModal(false); setEditingGoalId(null); }} className="w-full py-2 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
             </form>
          </div>
        </div>
      )}

      {showPWAInstruction && <PWAInstructions />}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}