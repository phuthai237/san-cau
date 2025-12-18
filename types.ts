
export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Booking {
  id: string;
  courtId: number;
  date: string; // Format: YYYY-MM-DD
  timeSlot: string; // Format: HH:mm (Thời gian dự kiến hoặc thời gian bắt đầu)
  actualStartTime?: string; // ISO String cho "Chơi ngay"
  isLive?: boolean; // Flag cho đơn chơi vãng lai tính theo giờ thực
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
