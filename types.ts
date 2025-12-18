
export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number; // Giá vốn nhập kho
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number; // Lưu giá vốn tại thời điểm bán để báo cáo chính xác
}

export interface Booking {
  id: string;
  courtId: number;
  date: string; // Format: YYYY-MM-DD
  timeSlot: string; // Format: HH:mm
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
