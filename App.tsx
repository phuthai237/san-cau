
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateTimeSlots, formatDateKey, formatVND, cn } from './utils';
import { Booking, Court as CourtType, TimeSlot, Product } from './types';
import { Court } from './Court';
import { BookingModal } from './BookingModal';
import { BookingDetailModal } from './BookingDetailModal';
import { Trash2, Trophy, ChevronLeft, ChevronRight, BarChart3, ShoppingBag, Plus, Calendar as CalendarIcon, CreditCard, Play, X, CheckCircle, Cloud, CloudOff, RefreshCw, Smartphone, Download, Apple, Info, ShieldCheck } from 'lucide-react';

const COURTS: CourtType[] = [
  { id: 1, name: 'Sân Số 1 (VIP)' },
  { id: 2, name: 'Sân Số 2 (Standard)' },
];

const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Nước suối Aquafina', price: 10000 },
  { id: '2', name: 'Revive Chanh Muối', price: 15000 },
  { id: '3', name: 'Sting Dâu', price: 15000 },
  { id: '4', name: 'Trà xanh không độ', price: 15000 },
  { id: '5', name: 'Cầu Hải Yến (Quả)', price: 20000 },
];

const TIME_SLOTS = generateTimeSlots(6, 22);
const PRICE_PER_HOUR = 60000;

const SYNC_API_BASE = 'https://kvdb.io/S3VzV1p4Z2h4Z2h4Z2h4/badminton_sync_';

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [syncId, setSyncId] = useState<string>(localStorage.getItem('badminton-sync-id') || '');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSynced, setLastSynced] = useState<number>(0);
  
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showQuickPlayMenu, setShowQuickPlayMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'shop' | 'stats'>('calendar');
  
  const [pendingBooking, setPendingBooking] = useState<{courtId: number, slot: TimeSlot} | null>(null);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);

  // PWA States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (isStandalone) {
      alert("Ứng dụng đã được cài đặt!");
      return;
    }
    if (!deferredPrompt) {
      alert("HƯỚNG DẪN CÀI ĐẶT:\n\n1. iPhone (Safari): Nhấn 'Chia sẻ' -> 'Thêm vào màn hình chính'.\n\n2. Android (Chrome): Nhấn '3 chấm' -> 'Cài đặt ứng dụng'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
  };

  useEffect(() => {
    const savedBookings = localStorage.getItem('badminton-bookings');
    const savedProducts = localStorage.getItem('badminton-products');
    if (savedBookings) setBookings(JSON.parse(savedBookings));
    if (savedProducts) setProducts(JSON.parse(savedProducts));
  }, []);

  const pushToCloud = useCallback(async (currentBookings: Booking[], currentProducts: Product[]) => {
    if (!syncId) return;
    setSyncStatus('syncing');
    try {
      const data = { bookings: currentBookings, products: currentProducts, timestamp: Date.now() };
      await fetch(`${SYNC_API_BASE}${syncId}`, { method: 'PUT', body: JSON.stringify(data) });
      setSyncStatus('success');
      setLastSynced(Date.now());
    } catch (e) { setSyncStatus('error'); }
  }, [syncId]);

  const pullFromCloud = useCallback(async () => {
    if (!syncId) return;
    setSyncStatus('syncing');
    try {
      const res = await fetch(`${SYNC_API_BASE}${syncId}`);
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData.timestamp > lastSynced) {
          setBookings(cloudData.bookings);
          setProducts(cloudData.products);
          setLastSynced(cloudData.timestamp);
        }
        setSyncStatus('success');
      }
    } catch (e) { setSyncStatus('error'); }
  }, [syncId, lastSynced]);

  useEffect(() => {
    localStorage.setItem('badminton-bookings', JSON.stringify(bookings));
    localStorage.setItem('badminton-products', JSON.stringify(products));
    localStorage.setItem('badminton-sync-id', syncId);
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (syncId) pullFromCloud();
      return;
    }
    const timer = setTimeout(() => { pushToCloud(bookings, products); }, 1500);
    return () => clearTimeout(timer);
  }, [bookings, products, syncId, pullFromCloud, pushToCloud]);

  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const isSlotBooked = useCallback((courtId: number, time: string) => {
    return bookings.some(b => b.courtId === courtId && b.date === dateKey && b.timeSlot === time && b.status === 'active');
  }, [bookings, dateKey]);

  const checkAvailability = useCallback((courtIds: number[], startSlotTime: string, durationSlots: number) => {
    const startIndex = TIME_SLOTS.findIndex(t => t.time === startSlotTime);
    if (startIndex === -1) return false;
    const neededSlots = TIME_SLOTS.slice(startIndex, startIndex + durationSlots).map(s => s.time);
    for (const courtId of courtIds) {
      for (const time of neededSlots) {
        if (isSlotBooked(courtId, time)) return false;
      }
    }
    return true;
  }, [isSlotBooked]);

  const handleSlotClick = useCallback((courtId: number, slot: TimeSlot) => {
    setPendingBooking({ courtId, slot });
    setIsBookingModalOpen(true);
  }, []);

  const handlePlayNow = useCallback((courtId: number) => {
    const now = new Date();
    const currentSlot = TIME_SLOTS.find(s => {
      const [h, m] = s.time.split(':').map(Number);
      const slotTotal = h * 60 + m;
      const nowTotal = now.getHours() * 60 + now.getMinutes();
      return nowTotal >= slotTotal && nowTotal < slotTotal + 30;
    }) || TIME_SLOTS[0];
    if (isSlotBooked(courtId, currentSlot.time)) {
      alert(`Sân ${courtId} đang bận!`);
      return;
    }
    const name = prompt("Tên khách:") || "Khách Vãng Lai";
    const newBooking: Booking = {
      id: 'live-' + Date.now(),
      courtId: courtId,
      date: dateKey,
      timeSlot: currentSlot.time,
      actualStartTime: now.toISOString(),
      isLive: true,
      customerName: name,
      phoneNumber: "Trực tiếp",
      totalAmount: 0,
      deposit: 0,
      remainingAmount: 0,
      serviceItems: [],
      status: 'active',
      durationSlots: 1
    };
    setBookings(prev => [...prev, newBooking]);
    setShowQuickPlayMenu(false);
  }, [dateKey, isSlotBooked]);

  const handleBookingConfirm = useCallback((data: any) => {
    if (!pendingBooking) return;
    const startIndex = TIME_SLOTS.findIndex(t => t.time === pendingBooking.slot.time);
    const slotsToBook = TIME_SLOTS.slice(startIndex, startIndex + data.durationSlots);
    const newBookings: Booking[] = [];
    const groupId = Math.random().toString(36).substr(2, 9);
    data.selectedCourtIds.forEach((courtId: number) => {
      slotsToBook.forEach(slot => {
        newBookings.push({
          id: Math.random().toString(36).substr(2, 9),
          courtId: courtId,
          date: dateKey,
          timeSlot: slot.time,
          customerName: data.name,
          phoneNumber: data.phone,
          totalAmount: data.totalAmount,
          deposit: data.deposit,
          remainingAmount: data.totalAmount - data.deposit,
          groupId: groupId,
          serviceItems: [],
          status: 'active',
          durationSlots: data.durationSlots
        });
      });
    });
    setBookings((prev) => [...prev, ...newBookings]);
    setIsBookingModalOpen(false);
  }, [pendingBooking, dateKey]);

  const handleUpdateBooking = useCallback((updated: Booking) => {
    setSelectedBookingForDetail(updated);
    setBookings(prev => {
      if (updated.groupId) {
        return prev.map(b => b.groupId === updated.groupId ? { ...updated, id: b.id, courtId: b.courtId, timeSlot: b.timeSlot } : b);
      }
      return prev.map(b => b.id === updated.id ? updated : b);
    });
  }, []);

  const handleCheckout = useCallback((booking: Booking, finalDurationSlots: number) => {
    setBookings(prev => {
      if (booking.courtId === 0) {
        return prev.map(b => b.id === booking.id ? { ...booking, status: 'paid', remainingAmount: 0 } : b);
      }
      if (booking.isLive && booking.actualStartTime) {
        const start = new Date(booking.actualStartTime);
        const end = new Date();
        const diffMs = end.getTime() - start.getTime();
        const hours = diffMs / (1000 * 60 * 60);
        const slotsUsed = Math.max(1, Math.ceil(hours * 2));
        const courtTotal = slotsUsed * (PRICE_PER_HOUR / 2);
        const serviceTotal = (booking.serviceItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return prev.map(b => b.id === booking.id ? { 
          ...booking, status: 'paid', totalAmount: courtTotal + serviceTotal, 
          remainingAmount: 0, durationSlots: slotsUsed 
        } : b);
      }
      const gId = booking.groupId || booking.id;
      const otherOnes = prev.filter(b => (b.groupId || b.id) !== gId);
      const groupOnes = prev.filter(b => (b.groupId || b.id) === gId);
      const results: Booking[] = [];
      const courtIds = Array.from(new Set(groupOnes.map(b => b.courtId)));
      courtIds.forEach(cId => {
        const courtSlots = groupOnes.filter(b => b.courtId === cId).sort((a,b) => a.timeSlot.localeCompare(b.timeSlot));
        const finalSlots = courtSlots.slice(0, Math.max(1, finalDurationSlots));
        finalSlots.forEach((s, idx) => {
          results.push({
            ...s, status: 'paid', totalAmount: idx === 0 ? booking.totalAmount / courtIds.length : 0, 
            remainingAmount: 0, serviceItems: idx === 0 ? booking.serviceItems : [], durationSlots: finalDurationSlots
          });
        });
      });
      return [...otherOnes, ...results];
    });
    setIsDetailModalOpen(false);
    setSelectedBookingForDetail(null);
  }, []);

  const handleOpenShopOnly = useCallback(() => {
    const name = prompt("Tên khách lẻ:") || "Khách lẻ";
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const virtualBooking: Booking = {
      id: 'shop-' + Date.now(), date: dateKey, customerName: name, phoneNumber: "Bán lẻ", courtId: 0, timeSlot: currentTime,
      totalAmount: 0, deposit: 0, remainingAmount: 0, serviceItems: [], status: 'active', durationSlots: 0, groupId: 'shop-group-' + Date.now()
    };
    setSelectedBookingForDetail(virtualBooking);
    setIsDetailModalOpen(true);
    setShowQuickPlayMenu(false);
  }, [dateKey]);

  const stats = useMemo(() => {
    const processedGroups = new Set<string>();
    let totalRevenue = 0; let totalDeposit = 0; let totalServices = 0;
    bookings.forEach(b => {
      if (b.status === 'paid') {
         totalRevenue += b.totalAmount;
         totalServices += (b.serviceItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
      } else {
         const gId = b.groupId || b.id;
         if (!processedGroups.has(gId)) { totalDeposit += b.deposit; processedGroups.add(gId); }
      }
    });
    return { totalRevenue, totalDeposit, totalServices };
  }, [bookings]);

  return (
    <div className="min-h-screen pb-40 bg-gray-50 flex flex-col font-inter safe-pb">
      <header className="bg-white/90 backdrop-blur-xl shadow-sm sticky top-0 z-40 border-b border-gray-100 px-4 pb-4 md:py-6 safe-pt">
        <div className="max-w-7xl mx-auto flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-2xl text-white shadow-xl shadow-emerald-200"><Trophy className="w-6 h-6 md:w-8 md:h-8" /></div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">Badminton Pro</h1>
              {syncId && (
                <div className="flex items-center gap-1 mt-1">
                  <div className={cn("w-2 h-2 rounded-full", syncStatus === 'success' ? "bg-emerald-500" : syncStatus === 'error' ? "bg-rose-500" : "bg-amber-500 animate-pulse")}></div>
                  <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">{syncStatus === 'success' ? 'Cloud Online' : syncStatus === 'error' ? 'Offline' : 'Syncing...'}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowQuickPlayMenu(true)} className="px-5 py-3 bg-emerald-600 text-white rounded-2xl flex items-center gap-2 font-black text-xs md:text-sm shadow-xl shadow-emerald-200 active:scale-95 transition-all">
              <Play className="w-3.5 h-3.5 fill-white" /> CHƠI NGAY
            </button>
            <button onClick={() => { if(window.confirm("Xóa sạch dữ liệu hệ thống?")) { setBookings([]); localStorage.clear(); window.location.reload(); } }} className="p-3 bg-rose-50 text-rose-500 rounded-2xl active:scale-95">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-8 md:py-10">
        {activeTab === 'calendar' && (
          <div className="space-y-6 md:space-y-12">
            <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-gray-100 flex items-center justify-between">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-4 hover:bg-emerald-50 rounded-2xl text-gray-400 active:scale-90"><ChevronLeft className="w-8 h-8" /></button>
              <div className="text-center">
                <span className="text-[10px] uppercase font-black text-emerald-500 tracking-[0.2em] block mb-1">LỊCH THI ĐẤU</span>
                <div className="text-xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase">{selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' })}</div>
              </div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-4 hover:bg-emerald-50 rounded-2xl text-gray-400 active:scale-90"><ChevronRight className="w-8 h-8" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
              {COURTS.map(court => (
                <Court
                  key={court.id} court={court}
                  bookings={bookings.filter(b => b.courtId === court.id && b.date === dateKey && b.status === 'active')}
                  timeSlots={TIME_SLOTS} onSlotClick={handleSlotClick}
                  onViewDetail={(b) => { setSelectedBookingForDetail(b); setIsDetailModalOpen(true); }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-lg border border-gray-100">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">KHO HÀNG</h2>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Quản lý sản phẩm</p>
              </div>
              <button onClick={() => {
                const name = prompt("Tên sản phẩm:"); const price = parseInt(prompt("Giá tiền:") || "0");
                if (name && price) setProducts([...products, { id: Date.now().toString(), name, price }]);
              }} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center gap-3 shadow-xl active:scale-95 transition-all"><Plus className="w-5 h-5 stroke-[4px]" /> THÊM</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {products.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-[2rem] border-2 border-gray-50 shadow-sm flex flex-col justify-between group hover:border-emerald-500 transition-all">
                  <div className="mb-4">
                    <div className="bg-gray-100 w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors mb-4"><ShoppingBag className="w-6 h-6" /></div>
                    <div className="text-lg font-black text-gray-900 leading-none tracking-tight uppercase truncate">{p.name}</div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="text-emerald-600 font-black text-sm">{formatVND(p.price)}</div>
                    <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
            <div className={cn("p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden transition-all duration-500", isStandalone ? "bg-emerald-600" : "bg-blue-600")}>
               <div className="absolute right-[-5%] top-[-10%] opacity-10"><ShieldCheck className="w-40 h-40" /></div>
               <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2">{isStandalone ? "CHẾ ĐỘ NATIVE APP" : "CÀI ĐẶT ỨNG DỤNG MOBILE"}</h3>
                    <p className="text-white/80 font-bold text-xs uppercase tracking-widest opacity-80 leading-relaxed">{isStandalone ? "Ứng dụng đang chạy mượt mà ở chế độ toàn màn hình như ứng dụng chuyên nghiệp." : "Đưa ứng dụng ra màn hình chính để sử dụng toàn màn hình và mượt mà hơn như app thật."}</p>
                  </div>
                  {!isStandalone && (
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      <button onClick={handleInstallClick} className="px-10 py-5 bg-white text-blue-700 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><Download className="w-6 h-6" /> CÀI ĐẶT NGAY</button>
                    </div>
                  )}
               </div>
            </div>
            <div className="bg-emerald-950 p-10 rounded-[3rem] text-white shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-8 border-t-8 border-emerald-800">
              <div className="space-y-1">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">DOANH THU</div>
                <div className="text-2xl md:text-4xl font-black tracking-tighter">{formatVND(stats.totalRevenue)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">TIỀN CỌC</div>
                <div className="text-2xl md:text-4xl font-black tracking-tighter">{formatVND(stats.totalDeposit)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">DỊCH VỤ</div>
                <div className="text-2xl md:text-4xl font-black tracking-tighter">{formatVND(stats.totalServices)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">TỔNG THU</div>
                <div className="text-2xl md:text-4xl font-black tracking-tighter text-rose-400">{formatVND(stats.totalRevenue + stats.totalDeposit)}</div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border-4 border-emerald-50 overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-gray-900 uppercase flex items-center gap-4 tracking-tighter"><Cloud className="w-8 h-8 text-emerald-600" /> ĐỒNG BỘ CLOUD</h3>
                  <button onClick={pullFromCloud} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl active:scale-90 transition-all"><RefreshCw className={cn("w-5 h-5", syncStatus === 'syncing' && "animate-spin")} /></button>
               </div>
               <div className="space-y-6">
                  <div className="p-5 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] ml-2">MÃ QUẢN LÝ CỬA HÀNG</label>
                      <input type="text" value={syncId} onChange={(e) => setSyncId(e.target.value)} placeholder="Nhập mã cửa hàng..." className="w-full mt-2 px-5 py-3 bg-white border-2 border-transparent focus:border-emerald-500 outline-none rounded-xl font-black text-lg text-gray-900 shadow-sm" />
                    </div>
                  </div>
               </div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden">
               <h3 className="text-xl font-black text-gray-900 uppercase mb-8 tracking-tighter flex items-center gap-3"><CreditCard className="w-7 h-7 text-emerald-600" /> GIAO DỊCH GẦN ĐÂY</h3>
               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                 {bookings.filter(b => b.status === 'paid' && b.totalAmount > 0).slice(-20).reverse().map(b => (
                    <div key={b.id} className="p-5 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-xl text-emerald-600 shadow-sm"><CheckCircle className="w-5 h-5" /></div>
                        <div>
                          <div className="font-black text-gray-900 uppercase text-sm tracking-tight">{b.customerName}</div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase">{b.courtId === 0 ? `Dịch vụ` : `Sân ${b.courtId}`} • {b.timeSlot}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-emerald-700 tracking-tighter">{formatVND(b.totalAmount)}</div>
                      </div>
                    </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50 px-6 pt-5 flex justify-around items-center rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.06)] safe-pb">
        {[ { id: 'calendar', icon: CalendarIcon, label: 'Lịch' }, { id: 'shop', icon: ShoppingBag, label: 'Kho' }, { id: 'stats', icon: BarChart3, label: 'Admin' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex flex-col items-center gap-1.5 pb-4 px-6 transition-all duration-300", activeTab === tab.id ? "text-emerald-600 scale-110" : "text-gray-300")}>
            <tab.icon className={cn("w-7 h-7", activeTab === tab.id ? "stroke-[3px]" : "stroke-2")} />
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {showQuickPlayMenu && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-emerald-900 p-7 text-white flex justify-between items-center">
              <div><h3 className="text-xl font-black uppercase tracking-tight">VÀO SÂN</h3><p className="text-emerald-100/50 text-[9px] font-bold uppercase tracking-widest">Bắt đầu tính giờ</p></div>
              <button onClick={() => setShowQuickPlayMenu(false)} className="p-2 bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3 bg-gray-50">
              {COURTS.map(court => (
                <button key={court.id} onClick={() => handlePlayNow(court.id)} className="w-full p-5 bg-white border border-gray-100 rounded-2xl flex items-center justify-between hover:border-emerald-500 active:scale-95 transition-all">
                  <div className="text-left font-black uppercase tracking-tight text-lg text-gray-900">{court.name}</div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600"><Play className="w-5 h-5 fill-current" /></div>
                </button>
              ))}
              <button onClick={handleOpenShopOnly} className="w-full p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between active:scale-95">
                <div className="text-left font-black uppercase tracking-tight text-lg text-blue-900">BÁN LẺ DỊCH VỤ</div>
                <div className="bg-blue-600 p-2.5 rounded-xl text-white"><ShoppingBag className="w-5 h-5" /></div>
              </button>
            </div>
          </div>
        </div>
      )}

      <BookingModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} onConfirm={handleBookingConfirm} courts={COURTS} initialCourtId={pendingBooking?.courtId || 0} dateStr={selectedDate.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })} timeSlot={pendingBooking?.slot || null} allTimeSlots={TIME_SLOTS} checkAvailability={checkAvailability} />
      <BookingDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} booking={selectedBookingForDetail} products={products} onUpdateBooking={handleUpdateBooking} onCheckout={handleCheckout} />
    </div>
  );
};

export default App;
