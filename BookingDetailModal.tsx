
import React, { useState, useEffect, useRef } from 'react';
import { X, User, Phone, ShoppingBag, Plus, Minus, Trash2, CheckCircle, Info, Play, Timer, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { Booking, Product, SaleItem } from './types';
import { formatVND, cn } from './utils';

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  products: Product[];
  onUpdateBooking: (updatedBooking: Booking) => void;
  onCheckout: (booking: Booking, finalDuration: number) => void;
}

const PRICE_PER_HOUR = 60000;

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  products,
  onUpdateBooking,
  onCheckout
}) => {
  const [tempDurationSlots, setTempDurationSlots] = useState(0);
  const [now, setNow] = useState(new Date());
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  useEffect(() => {
    if (booking) {
      setTempDurationSlots(booking.durationSlots || 0);
      setConfirming(false);
      setProcessing(false);
    }
  }, [booking?.id, isOpen]);

  useEffect(() => {
    let interval: any;
    if (isOpen && booking?.isLive) {
      interval = setInterval(() => setNow(new Date()), 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, booking?.isLive]);

  if (!isOpen || !booking) return null;

  const isShopOnly = booking.courtId === 0;
  const isLive = booking.isLive;

  let liveHours = 0;
  let livePrice = 0;
  if (isLive && booking.actualStartTime) {
    const start = new Date(booking.actualStartTime);
    const diffMs = now.getTime() - start.getTime();
    liveHours = diffMs / (1000 * 60 * 60);
    const slotsUsed = Math.max(1, Math.ceil(liveHours * 2));
    livePrice = slotsUsed * (PRICE_PER_HOUR / 2);
  }

  const handleAddProduct = (product: Product) => {
    const items = [...(booking.serviceItems || [])];
    const existingIndex = items.findIndex(i => i.productId === product.id);
    if (existingIndex > -1) {
      items[existingIndex].quantity += 1;
    } else {
      items.push({ productId: product.id, productName: product.name, quantity: 1, price: product.price });
    }
    updateTotals(items, tempDurationSlots);
  };

  const handleRemoveProduct = (productId: string) => {
    const items = (booking.serviceItems || []).filter(i => i.productId !== productId);
    updateTotals(items, tempDurationSlots);
  };

  const updateTotals = (items: SaleItem[], duration: number) => {
    const serviceTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let courtTotal = isLive ? livePrice : (isShopOnly ? 0 : duration * (PRICE_PER_HOUR / 2));
    
    onUpdateBooking({
      ...booking,
      serviceItems: items,
      durationSlots: duration,
      totalAmount: courtTotal + serviceTotal,
      remainingAmount: (courtTotal + serviceTotal) - booking.deposit
    });
  };

  const adjustDuration = (delta: number) => {
    if (isShopOnly || isLive) return;
    const newDuration = Math.max(1, tempDurationSlots + delta);
    setTempDurationSlots(newDuration);
    updateTotals(booking.serviceItems || [], newDuration);
  };

  const serviceTotal = (booking.serviceItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const currentCourtTotal = isLive ? livePrice : (isShopOnly ? 0 : tempDurationSlots * (PRICE_PER_HOUR / 2));
  const finalPayable = Math.max(0, (currentCourtTotal + serviceTotal) - booking.deposit);

  const handleFinalPay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      onCheckout(booking, tempDurationSlots);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-5xl h-[95dvh] md:h-auto md:max-h-[92dvh] flex flex-col overflow-hidden border-t-8 border-emerald-900 animate-in slide-in-from-bottom duration-300">
        <div className="bg-emerald-900 px-6 py-5 md:px-10 md:py-6 flex items-center justify-between shrink-0 shadow-lg relative z-10" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-4">
            {isLive ? <Timer className="w-8 h-8 md:w-10 md:h-10 text-emerald-400 animate-pulse" /> : <Info className="w-8 h-8 md:w-10 md:h-10 text-white" />} 
            <div className="leading-tight">
              <h3 className="text-white text-xl md:text-2xl font-black uppercase tracking-tight">
                {isLive ? 'ĐANG TÍNH GIỜ' : (isShopOnly ? 'HÓA ĐƠN LẺ' : 'CHI TIẾT ĐƠN')}
              </h3>
              <p className="text-emerald-100/50 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {isShopOnly ? 'Khách dịch vụ' : `Sân ${booking.courtId} | ${booking.timeSlot}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90">
            <X className="w-7 h-7" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50 flex flex-col gap-6 custom-scrollbar pb-48 md:pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">KHÁCH HÀNG</p>
                  <div className="text-lg font-black text-gray-900 truncate uppercase">{booking.customerName}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">SỐ ĐIỆN THOẠI</p>
                  <div className="text-lg font-black text-gray-900">{booking.phoneNumber}</div>
                </div>
              </section>
              {isLive ? (
                <section className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl text-center">
                  <p className="text-[10px] font-black uppercase text-blue-100 mb-4 tracking-[0.2em]">THỜI GIAN THỰC TẾ</p>
                  <div className="text-5xl md:text-6xl font-black tabular-nums tracking-tighter">
                    {Math.floor(liveHours).toString().padStart(2, '0')}:
                    {Math.floor((liveHours % 1) * 60).toString().padStart(2, '0')}:
                    {Math.floor(((liveHours * 60) % 1) * 60).toString().padStart(2, '0')}
                  </div>
                  <div className="mt-6 pt-6 border-t border-white/20 flex justify-between items-center px-4">
                    <span className="text-[10px] font-black uppercase text-blue-200">Tiền sân tạm tính</span>
                    <span className="text-2xl font-black">{formatVND(livePrice)}</span>
                  </div>
                </section>
              ) : !isShopOnly && (
                <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
                  <button onClick={() => adjustDuration(-1)} className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center active:scale-90 transition-all"><Minus className="w-7 h-7 stroke-[3px]" /></button>
                  <div className="text-center">
                    <div className="text-4xl font-black text-emerald-950 leading-none">{tempDurationSlots / 2} <span className="text-base uppercase">Giờ</span></div>
                    <p className="text-[10px] text-emerald-600 font-black mt-2 uppercase tracking-widest">{tempDurationSlots} Slot</p>
                  </div>
                  <button onClick={() => adjustDuration(1)} className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center active:scale-90 transition-all shadow-lg"><Plus className="w-7 h-7 stroke-[3px]" /></button>
                </section>
              )}
            </div>
            <div className="space-y-6">
              <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> THÊM DỊCH VỤ</h4>
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                  {products.map(p => (
                    <button key={p.id} onClick={() => handleAddProduct(p)} className="p-3 bg-gray-50 border border-transparent rounded-xl text-left hover:border-emerald-500 hover:bg-white active:scale-95 transition-all group">
                      <div className="font-black text-gray-900 text-xs truncate uppercase group-hover:text-emerald-700">{p.name}</div>
                      <div className="text-[10px] font-black text-emerald-600">{formatVND(p.price)}</div>
                    </button>
                  ))}
                </div>
              </section>
              <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[180px]">
                <h4 className="text-[10px] font-black text-gray-900 uppercase mb-4 tracking-widest">ĐÃ CHỌN ({booking.serviceItems?.length || 0})</h4>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {booking.serviceItems?.map(item => (
                    <div key={item.productId} className="flex items-center justify-between bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-emerald-950 text-[11px] truncate uppercase">{item.productName}</div>
                        <div className="text-[10px] text-emerald-600 font-bold uppercase">{item.quantity} x {formatVND(item.price)}</div>
                      </div>
                      <button onClick={() => handleRemoveProduct(item.productId)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg active:scale-90"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  ))}
                  {(!booking.serviceItems || booking.serviceItems.length === 0) && <div className="text-center py-8 text-gray-300 text-[10px] font-bold uppercase italic opacity-50">Chưa có sản phẩm</div>}
                </div>
              </section>
            </div>
          </div>
        </div>
        <div className="shrink-0 bg-white border-t border-gray-200 p-6 md:p-8 flex flex-col gap-6 shadow-[0_-15px_30px_rgba(0,0,0,0.08)] relative z-20" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          <div className="bg-emerald-950 rounded-[2rem] p-6 text-white flex items-center justify-between shadow-2xl border-t border-white/10">
             <div className="space-y-1">
                <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> CẦN THANH TOÁN
                </div>
                <div className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums leading-none">
                  {formatVND(finalPayable)}
                </div>
             </div>
             <div className="text-right hidden sm:block">
                <div className="text-[9px] font-black text-gray-500 uppercase">TIỀN SÂN: {formatVND(currentCourtTotal)}</div>
                <div className="text-[9px] font-black text-gray-500 uppercase">DỊCH VỤ: {formatVND(serviceTotal)}</div>
                {booking.deposit > 0 && <div className="text-[9px] font-black text-rose-500 uppercase">ĐÃ CỌC: -{formatVND(booking.deposit)}</div>}
             </div>
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 py-5 bg-gray-100 text-gray-500 text-sm font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all hover:bg-gray-200">Hủy bỏ</button>
            <button disabled={processing} onClick={handleFinalPay} className={cn("flex-[2.5] py-5 text-white text-xl font-black rounded-2xl shadow-2xl uppercase tracking-tight flex items-center justify-center gap-3 active:scale-95 transition-all touch-manipulation relative overflow-hidden", processing ? "bg-emerald-900" : confirming ? "bg-amber-500 scale-105" : "bg-emerald-600 shadow-emerald-200")}>
              {processing ? <Loader2 className="w-8 h-8 animate-spin" /> : confirming ? <><AlertTriangle className="w-7 h-7 animate-bounce" /> BẤM LẦN NỮA ĐỂ XÁC NHẬN!</> : <><CheckCircle className="w-7 h-7 stroke-[3px]" /> XÁC NHẬN THANH TOÁN</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
