export type TransactionType = 'FIXED' | 'VARIABLE' | 'INSTALLMENT';
export type TransactionKind = 'EXPENSE' | 'INCOME';
export type PaymentMethod = 'DEBIT' | 'CREDIT' | 'PIX' | 'CASH' | 'TRANSFER';
export type HouseholdMode = 'INDIVIDUAL' | 'HOUSEHOLD';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: 'OWNER' | 'MEMBER';
}

export interface Income {
  id: string;
  userId: string;
  name: string;
  amount: number;
  day: number;
  active?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  kind?: TransactionKind;
  type: TransactionType;
  name: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod?: PaymentMethod;
  installmentsCount?: number;
  currentInstallment?: number;
  parentId?: string;
  isPaid: boolean;
  paidMonths?: string[];
  notes?: string;
  tags?: string[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyAmount: number;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  deadline?: string;
  color?: string;
  icon?: string;
}

export interface CategoryBudget {
  id: string;
  category: string;
  amount: number;
}

export interface AppSettings {
  householdName: string;
  responsibleName: string;
  mode: HouseholdMode;
  hideValues: boolean;
}

export interface AppState {
  users: User[];
  currentUser: User | null;
  incomes: Income[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  budgets: CategoryBudget[];
  settings: AppSettings;
  selectedMonth: Date;
}
