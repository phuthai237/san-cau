
import { TimeSlot } from './types';

export const generateTimeSlots = (startHour: number, endHour: number, intervalMinutes: number = 30): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  let currentMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  while (currentMinutes < endMinutes) {
    const startH = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
    const startM = (currentMinutes % 60).toString().padStart(2, '0');
    
    const nextMinutes = currentMinutes + intervalMinutes;
    const endH = Math.floor(nextMinutes / 60).toString().padStart(2, '0');
    const endM = (nextMinutes % 60).toString().padStart(2, '0');

    slots.push({
      time: `${startH}:${startM}`,
      display: `${startH}:${startM} - ${endH}:${endM}`
    });
    
    currentMinutes = nextMinutes;
  }
  return slots;
};

export const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

// Hàm gửi thông báo hệ thống
export const sendNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: 'https://cdn-icons-png.flaticon.com/512/3058/3058284.png'
    });
  }
};
