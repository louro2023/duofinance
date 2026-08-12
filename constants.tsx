import type { PaymentMethod } from './types.ts';

export const CATEGORIES = [
  { id: 'housing', name: 'Moradia', icon: 'Home', color: '#7c3aed' },
  { id: 'food', name: 'Alimentação', icon: 'Utensils', color: '#f97316' },
  { id: 'transport', name: 'Transporte', icon: 'Car', color: '#2563eb' },
  { id: 'health', name: 'Saúde', icon: 'HeartPulse', color: '#e11d48' },
  { id: 'education', name: 'Educação', icon: 'GraduationCap', color: '#0891b2' },
  { id: 'leisure', name: 'Lazer', icon: 'Clapperboard', color: '#db2777' },
  { id: 'services', name: 'Serviços', icon: 'Zap', color: '#ca8a04' },
  { id: 'shopping', name: 'Compras', icon: 'ShoppingBag', color: '#4f46e5' },
  { id: 'subscriptions', name: 'Assinaturas', icon: 'Repeat2', color: '#9333ea' },
  { id: 'taxes', name: 'Impostos', icon: 'Landmark', color: '#475569' },
  { id: 'goals', name: 'Metas e reservas', icon: 'PiggyBank', color: '#059669' },
  { id: 'others', name: 'Outros', icon: 'Package', color: '#64748b' },
] as const;

export const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salário' },
  { id: 'freelance', name: 'Renda extra' },
  { id: 'investments', name: 'Investimentos' },
  { id: 'refund', name: 'Reembolso' },
  { id: 'other_income', name: 'Outras receitas' },
] as const;

export const PAYMENT_METHODS: { id: PaymentMethod; name: string }[] = [
  { id: 'PIX', name: 'Pix' },
  { id: 'DEBIT', name: 'Débito' },
  { id: 'CREDIT', name: 'Crédito' },
  { id: 'CASH', name: 'Dinheiro' },
  { id: 'TRANSFER', name: 'Transferência' },
];

export const GOAL_COLORS = ['#7c3aed', '#0891b2', '#059669', '#ea580c', '#db2777'];
