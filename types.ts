
export type TransactionType = 'FIXED' | 'VARIABLE' | 'INSTALLMENT';
export type PaymentMethod = 'DEBIT' | 'CREDIT' | 'PIX' | 'CASH';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
}

export interface Income {
  id: string;
  userId: string;
  name: string;
  amount: number;
  day: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  name: string;
  amount: number;
  category: string;
  date: string; // ISO string
  paymentMethod?: PaymentMethod;
  installmentsCount?: number;
  currentInstallment?: number;
  parentId?: string; // For installments
  isPaid: boolean;
  notes?: string;
  tags?: string[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyAmount: number; // Valor que será descontado mensalmente do salário
  type: 'PERCENTAGE' | 'FIXED';
  value: number; // For percentage goals
}

export interface AppState {
  users: User[];
  currentUser: User | null;
  incomes: Income[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  selectedMonth: Date;
}
