
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, User, Phone, Clock, Calendar, CheckCircle, AlertCircle, Layers, ArrowRight, Wallet, CreditCard, Banknote } from 'lucide-react';
import { TimeSlot, Court } from './types';
import { cn, formatVND } from './utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    phone: string;
    durationSlots: number;
    selectedCourtIds: number[];
    totalAmount: number;
    deposit: number;
  }) => void;
  courts: Court[];
  initialCourtId: number;
  dateStr: string;
  timeSlot: TimeSlot | null;
  allTimeSlots: TimeSlot[];
  checkAvailability: (courtIds: number[], startSlot: string, durationSlots: number) => boolean;
}

const PRICE_PER_SLOT = 30000;

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  courts,
  initialCourtId,
  dateStr,
  timeSlot,
  allTimeSlots,
  checkAvailability
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [endTimeValue, setEndTimeValue] = useState('');
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [deposit, setDeposit] = useState<number>(0);
  const [error, setError] = useState('');
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPhone('');
      setDeposit(0);
      setSelectedCourtIds([initialCourtId]);
      setError('');
      setEndTimeValue('');
      isFirstLoad.current = true;
    }
  }, [isOpen, initialCourtId]);

  const availableEndTimes = useMemo(() => {
    if (!timeSlot || !isOpen || selectedCourtIds.length === 0) return [];
    
    const startIndex = allTimeSlots.findIndex(s => s.time === timeSlot.time);
    const options: { time: string; duration: number }[] = [];
    
    for (let i = startIndex + 1; i <= allTimeSlots.length; i++) {
      const duration = i - startIndex;
      const isStillAvailable = checkAvailability(selectedCourtIds, timeSlot.time, duration);
      
      if (!isStillAvailable) break;

      let endTimeStr = '';
      if (i < allTimeSlots.length) {
        endTimeStr = allTimeSlots[i].time;
      } else {
        const lastSlot = allTimeSlots[allTimeSlots.length - 1];
        const [h, m] = lastSlot.time.split(':').map(Number);
        const total = h * 60 + m + 30;
        endTimeStr = `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
      }
      options.push({ time: endTimeStr, duration });
    }
    return options;
  }, [timeSlot, allTimeSlots, selectedCourtIds, checkAvailability, isOpen]);

  useEffect(() => {
    if (isOpen && availableEndTimes.length > 0 && isFirstLoad.current) {
      const oneHourOption = availableEndTimes.find(opt => opt.duration === 2);
      setEndTimeValue(oneHourOption ? oneHourOption.time : availableEndTimes[0].time);
      isFirstLoad.current = false;
    }
  }, [isOpen, availableEndTimes]);

  if (!isOpen || !timeSlot) return null;

  const currentDurationObj = availableEndTimes.find(opt => opt.time === endTimeValue);
  const durationSlots = currentDurationObj ? currentDurationObj.duration : 1;
  const totalAmount = durationSlots * selectedCourtIds.length * PRICE_PER_SLOT;
  const remainingAmount = totalAmount - deposit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('NHẬP ĐỦ TÊN & SĐT');
      return;
    }
    onConfirm({ name, phone, durationSlots, selectedCourtIds, totalAmount, deposit });
  };

  const toggleCourt = (courtId: number) => {
    setSelectedCourtIds(prev => {
      if (prev.includes(courtId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== courtId);
      }
      return [...prev, courtId];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="bg-emerald-600 px-6 py-5 md:px-10 md:py-8 flex items-center justify-between shrink-0" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
          <div><h3 className="text-white text-2xl md:text-4xl font-black flex items-center gap-3"><CheckCircle className="w-8 h-8 md:w-12 md:h-12" /> ĐẶT LỊCH</h3><p className="text-emerald-100 text-xs md:text-lg font-bold uppercase tracking-widest mt-1">60K / GIỜ</p></div>
          <button onClick={onClose} className="text-white/80 p-2 md:p-3 bg-white/10 rounded-2xl"><X className="w-8 h-8 md:w-10 md:h-10" /></button>
        </div>
        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar bg-gray-50/30 flex-1 pb-40">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <div className="space-y-6">
                <div className="bg-white border-2 border-gray-100 shadow-lg rounded-[2rem] p-6 space-y-4">
                    <div className="flex items-center gap-3 text-gray-900 font-black text-lg md:text-2xl border-b-2 border-gray-50 pb-4 uppercase"><Calendar className="w-6 h-6 text-emerald-600" /><span>{dateStr}</span></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] uppercase font-black text-gray-400">GIỜ ĐẾN</label><div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 font-black text-xl text-gray-800">{timeSlot.time}</div></div>
                        <div className="space-y-1"><label className="text-[10px] uppercase font-black text-gray-400">GIỜ VỀ</label><select value={endTimeValue} onChange={(e) => setEndTimeValue(e.target.value)} className="w-full p-4 rounded-2xl border-4 border-emerald-500 bg-white font-black text-xl text-emerald-700 outline-none">{availableEndTimes.map(opt => <option key={opt.time} value={opt.time}>{opt.time}</option>)}</select></div>
                    </div>
                </div>
                <div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><Layers className="w-4 h-4" /> CHỌN SÂN</label><div className="grid grid-cols-1 gap-3">{courts.map(court => { const isSelected = selectedCourtIds.includes(court.id); return (<button key={court.id} type="button" onClick={() => toggleCourt(court.id)} className={cn("w-full py-5 px-6 rounded-2xl border-4 text-lg font-black transition-all flex items-center justify-between", isSelected ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md" : "border-gray-200 bg-white text-gray-300")}>{court.name}{isSelected && <CheckCircle className="w-6 h-6 text-emerald-600" />}</button>)})}</div></div>
            </div>
            <div className="space-y-6">
                <div className="space-y-4"><label className="text-[10px] font-black text-gray-400 uppercase ml-2 flex items-center gap-2"><User className="w-4 h-4" /> THÔNG TIN KHÁCH</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-6 py-5 bg-white border-4 border-gray-100 rounded-[1.5rem] focus:border-emerald-500 outline-none font-black text-xl text-gray-900 shadow-md placeholder:text-gray-300" placeholder="HỌ TÊN..." /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-6 py-5 bg-white border-4 border-gray-100 rounded-[1.5rem] focus:border-emerald-500 outline-none font-black text-xl text-gray-900 shadow-md placeholder:text-gray-300" placeholder="SỐ ĐIỆN THOẠI..." /></div>
                <div className="bg-emerald-950 rounded-[2.5rem] p-6 text-white space-y-6 shadow-xl border-t border-white/10"><div className="text-center border-b border-white/10 pb-6"><span className="text-[10px] text-gray-400 font-black uppercase tracking-widest block mb-2">TỔNG THANH TOÁN</span><span className="text-4xl md:text-5xl font-black text-emerald-400">{formatVND(totalAmount)}</span></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><span className="text-[10px] text-gray-500 font-black uppercase">ĐÃ CỌC</span><input type="number" value={deposit || ''} onChange={(e) => setDeposit(Math.max(0, Number(e.target.value)))} className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-center font-black text-xl text-white outline-none" placeholder="0" /></div><div className="space-y-1"><span className="text-[10px] text-rose-400 font-black uppercase">CÒN THIẾU</span><div className="w-full bg-rose-500/10 border-2 border-rose-500/30 rounded-xl px-4 py-3 text-center font-black text-xl text-rose-400">{formatVND(remainingAmount)}</div></div></div></div>
            </div>
            {error && <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-center font-black uppercase text-sm tracking-widest">{error}</div>}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t md:static md:p-0 md:bg-transparent md:border-0 flex gap-4" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}><button type="button" onClick={onClose} className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase">HỦY</button><button type="submit" className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-emerald-200 uppercase">XÁC NHẬN</button></div>
          </form>
        </div>
      </div>
    </div>
  );
};
