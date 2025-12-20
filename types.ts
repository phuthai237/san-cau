export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number;
}

export const SUPPORTED_BANKS = [
  { id: 'mbb', name: 'MB Bank (Quân Đội)' },
  { id: 'vcb', name: 'Vietcombank' },
  { id: 'tcb', name: 'Techcombank' },
  { id: 'bidv', name: 'BIDV' },
  { id: 'ctg', name: 'VietinBank' },
  { id: 'acb', name: 'ACB' },
  { id: 'tpb', name: 'TPBank' },
  { id: 'vpb', name: 'VPBank' },
  { id: 'agribank', name: 'Agribank' }
];

export interface BankConfig {
  bankId: string;
  accountNo: string;
  accountName: string;
  apiService: 'none' | 'casso' | 'sepay';
  apiKey: string;
}

export interface Booking {
  id: string;
  courtId: number;
  date: string;
  timeSlot: string;
  actualStartTime?: string; 
  isLive?: boolean; 
  customerName: string;
  phoneNumber: string;
  totalAmount: number;
  deposit: number;
  remainingAmount: number;
  groupId?: string; 
  serviceItems?: SaleItem[];
  status: 'active' | 'paid';
  durationSlots: number;
}

export interface TimeSlot {
  time: string;
  display: string;
}

export interface Court {
  id: number;
  name: string;
}