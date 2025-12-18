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

export const getEndTime = (startTime: string, durationMinutes: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  
  const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const endM = (totalMinutes % 60).toString().padStart(2, '0');
  
  return `${endH}:${endM}`;
};