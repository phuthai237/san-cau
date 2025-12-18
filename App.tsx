
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateTimeSlots, formatDateKey, formatVND, cn, getStartOfWeek, getStartOfMonth, sendNotification } from './utils';
import { Booking, Court as CourtType, TimeSlot, Product } from './types';
import { Court } from './Court';
import { BookingModal } from './BookingModal';
import { BookingDetailModal } from './BookingDetailModal';
import { ProductModal } from './ProductModal';
import { Trash2, Trophy, ChevronLeft, ChevronRight, BarChart3, ShoppingBag, Plus, Calendar as CalendarIcon, CreditCard, Play, X, CheckCircle, Cloud, RefreshCw, Smartphone, Download, Apple, ShieldCheck, Share, MoveDown, TrendingUp, Filter, Wallet, PieChart, Bell, Zap, Info } from 'lucide-react';

const COURTS: CourtType[] = [
  { id: 1, name: 'Sân Số 1 (VIP)' },
  { id: 2, name: 'Sân Số 2 (Standard)' },
];

const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Nước suối Aquafina', price: 10000, costPrice: 5000 },
  { id: '2', name: 'Revive Chanh Muối', price: 15000, costPrice: 8000 },
  { id: '3', name: 'Sting Dâu', price: 15000, costPrice: 8000 },
  { id: '4', name: 'Trà xanh không độ', price: 15000, costPrice: 8000 },
  { id: '5', name: 'Cầu Hải Yến (Quả)', price: 20000, costPrice: 15000 },
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
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [showQuickPlayMenu, setShowQuickPlayMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'shop' | 'stats'>('calendar');
  
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [statsAnchorDate, setStatsAnchorDate] = useState<Date>(new Date());

  const [pendingBooking, setPendingBooking] = useState<{courtId: number, slot: TimeSlot} | null>(null);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  const isInitialMount = useRef(true);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');

    // Kiểm tra xem app đã chạy ở chế độ Standalone (đã cài đặt) chưa
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('PWA Ready');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      alert("🎉 Cài đặt thành công! Bây giờ bạn có thể mở app từ màn hình chính.");
    });

    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setNotifPermission);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (platform === 'ios') { 
      setShowIOSGuide(true); 
      return; 
    }
    
    if (deferredPrompt) { 
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { 
        setDeferredPrompt(null); 
      }
    } else {
      alert("💡 HƯỚNG DẪN CÀI ĐẶT:\n\n1. Nhấn vào nút 3 chấm (Menu) ở góc trên bên phải Chrome.\n2. Chọn dòng 'Cài đặt ứng dụng' (Install app) hoặc 'Thêm vào màn hình chính'.\n3. Sau đó app sẽ xuất hiện trên màn hình điện thoại như một ứng dụng thông thường.");
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
      for (const time of neededSlots) { if (isSlotBooked(courtId, time)) return false; }
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
      id: 'live-' + Date.now(), courtId: courtId, date: dateKey, timeSlot: currentSlot.time,
      actualStartTime: now.toISOString(), isLive: true, customerName: name, phoneNumber: "Trực tiếp",
      totalAmount: 0, deposit: 0, remainingAmount: 0, serviceItems: [], status: 'active', durationSlots: 1
    };
    setBookings(prev => [...prev, newBooking]);
    setShowQuickPlayMenu(false);
    
    sendNotification("🏸 Vào sân trực tiếp", `Khách ${name} đã bắt đầu chơi tại Sân số ${courtId}`);
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
          id: Math.random().toString(36).substr(2, 9), courtId: courtId, date: dateKey, timeSlot: slot.time,
          customerName: data.name, phoneNumber: data.phone, totalAmount: data.totalAmount, deposit: data.deposit,
          remainingAmount: data.totalAmount - data.deposit, groupId: groupId, serviceItems: [], status: 'active',
          durationSlots: data.durationSlots
        });
      });
    });
    setBookings((prev) => [...prev, ...newBookings]);
    setIsBookingModalOpen(false);

    sendNotification("✅ Đặt lịch thành công", `${data.name} đã đặt sân lúc ${pendingBooking.slot.time}`);
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
      if (booking.courtId === 0) { return prev.map(b => b.id === booking.id ? { ...booking, status: 'paid', remainingAmount: 0 } : b); }
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

    sendNotification("💰 Thanh toán hoàn tất", `Khách ${booking.customerName} đã thanh toán ${formatVND(booking.totalAmount)}`);
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
    const start = new Date(statsAnchorDate);
    let end = new Date(statsAnchorDate);
    if (statsPeriod === 'day') { start.setHours(0,0,0,0); end.setHours(23,59,59,999); } 
    else if (statsPeriod === 'week') {
      const sw = getStartOfWeek(statsAnchorDate); start.setTime(sw.getTime()); start.setHours(0,0,0,0);
      end.setTime(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    } 
    else if (statsPeriod === 'month') {
      const sm = getStartOfMonth(statsAnchorDate); start.setTime(sm.getTime()); start.setHours(0,0,0,0);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const filteredPaid = bookings.filter(b => {
      const bDate = new Date(b.date);
      return b.status === 'paid' && bDate >= start && bDate <= end;
    });

    let totalRevenue = 0;
    let totalServicesRevenue = 0;
    let totalCourtRevenue = 0;
    let totalCost = 0;

    filteredPaid.forEach(b => {
      totalRevenue += b.totalAmount;
      const sRev = (b.serviceItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const sCost = (b.serviceItems || []).reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      totalServicesRevenue += sRev;
      totalCost += sCost;
      totalCourtRevenue += (b.totalAmount - sRev);
    });

    const totalProfit = totalRevenue - totalCost;

    return { totalRevenue, totalServicesRevenue, totalCourtRevenue, totalCost, totalProfit, filteredPaid, start, end };
  }, [bookings, statsPeriod, statsAnchorDate]);

  const adjustStatsAnchor = (delta: number) => {
    const d = new Date(statsAnchorDate);
    if (statsPeriod === 'day') d.setDate(d.getDate() + delta);
    else if (statsPeriod === 'week') d.setDate(d.getDate() + delta * 7);
    else if (statsPeriod === 'month') d.setMonth(d.getMonth() + delta);
    setStatsAnchorDate(d);
  };

  const handleAddNewProductConfirm = (data: Omit<Product, 'id'>) => {
    setProducts(prev => [...prev, { 
      id: Date.now().toString(), 
      ...data
    }]);
  };

  return (
    <div className="min-h-screen pb-40 bg-gray-50 flex flex-col font-inter safe-pb">
      <header className="bg-white/90 backdrop-blur-xl shadow-sm sticky top-0 z-40 border-b border-gray-100 px-4 pb-4 md:py-6 safe-pt">
        <div className="max-w-7xl mx-auto flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-2xl text-white shadow-xl shadow-emerald-200"><Trophy className="w-6 h-6 md:w-8 md:h-8" /></div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">Badminton Pro</h1>
              <div className="flex items-center gap-2 mt-1">
                {syncId && (
                  <>
                    <div className={cn("w-2 h-2 rounded-full", syncStatus === 'success' ? "bg-emerald-500" : syncStatus === 'error' ? "bg-rose-500" : "bg-amber-500 animate-pulse")}></div>
                    <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">{syncStatus === 'success' ? 'Online' : 'Syncing...'}</span>
                  </>
                )}
                {notifPermission === 'granted' && <Bell className="w-2.5 h-2.5 text-emerald-500" />}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowQuickPlayMenu(true)} className="px-5 py-3 bg-emerald-600 text-white rounded-2xl flex items-center gap-2 font-black text-xs md:text-sm shadow-xl active:scale-95 transition-all">
              <Play className="w-3.5 h-3.5 fill-white" /> CHƠI NGAY
            </button>
            <button onClick={() => { if(window.confirm("Xóa sạch dữ liệu?")) { setBookings([]); localStorage.clear(); window.location.reload(); } }} className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-8 md:py-10">
        {activeTab === 'calendar' && (
          <div className="space-y-6 md:space-y-12">
            <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-gray-100 flex items-center justify-between">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-4 hover:bg-emerald-50 rounded-2xl text-gray-400"><ChevronLeft className="w-8 h-8" /></button>
              <div className="text-center">
                <span className="text-[10px] uppercase font-black text-emerald-500 tracking-[0.2em] block mb-1">LỊCH TRÌNH</span>
                <div className="text-xl md:text-5xl font-black text-gray-900 uppercase">{selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long' })}</div>
              </div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-4 hover:bg-emerald-50 rounded-2xl text-gray-400"><ChevronRight className="w-8 h-8" /></button>
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
                <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Kho hàng</h2>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Sản phẩm & Dịch vụ</p>
              </div>
              <button 
                onClick={() => setIsProductModalOpen(true)} 
                className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center gap-3 shadow-xl active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5 stroke-[4px]" /> THÊM MỚI
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {products.map(p => (
                <div key={p.id} className="bg-white p-6 rounded-[2rem] border-2 border-gray-50 shadow-sm flex flex-col justify-between group hover:border-emerald-500 transition-all">
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-gray-100 w-12 h-12 rounded-xl flex items-center justify-center text-gray-400"><ShoppingBag className="w-6 h-6" /></div>
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="p-2 text-gray-300 hover:text-rose-500"><Trash2 className="w-5 h-5" /></button>
                    </div>
                    <div className="text-xl font-black text-gray-900 uppercase mb-4">{p.name}</div>
                    <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 rounded-xl">
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Giá bán</span>
                        <span className="font-black text-emerald-900 text-lg">{formatVND(p.price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
            {/* PWA Install Status for Android */}
            {!isStandalone && (
              <div className="bg-emerald-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 group">
                <div className="absolute right-[-5%] top-[-10%] opacity-10"><Zap className="w-40 h-40 group-hover:scale-110 transition-transform duration-500" /></div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">PWA Mode</span>
                    {deferredPrompt ? (
                      <span className="px-3 py-1 bg-emerald-400 text-emerald-950 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">Sẵn sàng cài đặt</span>
                    ) : (
                      <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">Hỗ trợ Android</span>
                    )}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2">CÀI ĐẶT ỨNG DỤNG</h3>
                  <p className="text-white/80 font-bold text-xs uppercase tracking-widest opacity-80 leading-relaxed">Cài đặt để sử dụng như app thật trên màn hình chính, không cần trình duyệt.</p>
                </div>
                <button onClick={handleInstallClick} className="px-10 py-5 bg-white text-emerald-700 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
                  <Download className="w-6 h-6" /> CÀI ĐẶT NGAY
                </button>
              </div>
            )}

            {isStandalone && (
              <div className="bg-white p-6 rounded-[2rem] border-4 border-emerald-500/20 flex items-center gap-4">
                 <div className="bg-emerald-500 p-3 rounded-xl text-white"><ShieldCheck className="w-6 h-6" /></div>
                 <div>
                   <div className="font-black text-emerald-900 text-sm uppercase">Đã cài đặt thành công</div>
                   <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Bạn đang sử dụng phiên bản App Native</div>
                 </div>
              </div>
            )}
            
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto">
                        {(['day', 'week', 'month'] as const).map(p => (
                            <button key={p} onClick={() => { setStatsPeriod(p); setStatsAnchorDate(new Date()); }} className={cn("flex-1 md:px-8 py-3 rounded-xl font-black text-xs uppercase transition-all", statsPeriod === p ? "bg-white text-emerald-700 shadow-md" : "text-gray-400")}>
                                {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : 'Tháng'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-6 bg-emerald-50 px-6 py-3 rounded-2xl">
                        <button onClick={() => adjustStatsAnchor(-1)} className="p-2 text-emerald-600"><ChevronLeft className="w-6 h-6" /></button>
                        <span className="font-black text-emerald-900 uppercase text-sm">BÁO CÁO</span>
                        <button onClick={() => adjustStatsAnchor(1)} className="p-2 text-emerald-600"><ChevronRight className="w-6 h-6" /></button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-2 relative overflow-hidden">
                        <div className="absolute right-[-10%] bottom-[-10%] opacity-10"><PieChart className="w-32 h-32" /></div>
                        <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4" /> LỢI NHUẬN THỰC</div>
                        <div className="text-3xl md:text-5xl font-black tracking-tighter">{formatVND(stats.totalProfit)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <div className="bg-emerald-950 p-6 rounded-[2rem] text-white space-y-1">
                            <div className="text-[9px] font-black text-emerald-400 uppercase">TỔNG DOANH THU</div>
                            <div className="text-xl font-black">{formatVND(stats.totalRevenue)}</div>
                        </div>
                        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 space-y-1">
                            <div className="text-[9px] font-black text-rose-400 uppercase">TỔNG GIÁ VỐN</div>
                            <div className="text-xl font-black text-rose-700">{formatVND(stats.totalCost)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden">
               <h3 className="text-xl font-black text-gray-900 uppercase mb-8 flex items-center gap-3"><CreditCard className="w-7 h-7 text-emerald-600" /> LỊCH SỬ GIAO DỊCH</h3>
               <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                 {stats.filteredPaid.length > 0 ? (
                    stats.filteredPaid.slice().reverse().map(b => (
                        <div key={b.id} className="p-5 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
                          <div>
                            <div className="font-black text-gray-900 uppercase text-sm">{b.customerName}</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase">{b.date} • {b.courtId === 0 ? 'Dịch vụ' : `Sân ${b.courtId}`}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-emerald-700">{formatVND(b.totalAmount)}</div>
                            <div className="text-[8px] font-black text-gray-400 uppercase">LN: +{formatVND(b.totalAmount - (b.serviceItems || []).reduce((s, i) => s + (i.costPrice * i.quantity), 0))}</div>
                          </div>
                        </div>
                    ))
                 ) : <div className="py-10 text-center opacity-30">Không có dữ liệu</div>}
               </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50 px-6 pt-5 flex justify-around items-center rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.06)] safe-pb">
        {[ { id: 'calendar', icon: CalendarIcon, label: 'Lịch' }, { id: 'shop', icon: ShoppingBag, label: 'Kho' }, { id: 'stats', icon: BarChart3, label: 'Admin' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex flex-col items-center gap-1.5 pb-4 px-6 transition-all", activeTab === tab.id ? "text-emerald-600 scale-110" : "text-gray-300")}>
            <tab.icon className={cn("w-7 h-7", activeTab === tab.id ? "stroke-[3px]" : "stroke-2")} />
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {showQuickPlayMenu && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-emerald-900 p-7 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">VÀO SÂN NHANH</h3>
              <button onClick={() => setShowQuickPlayMenu(false)} className="p-2 bg-white/10 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3 bg-gray-50">
              {COURTS.map(court => (
                <button key={court.id} onClick={() => handlePlayNow(court.id)} className="w-full p-5 bg-white border border-gray-100 rounded-2xl flex items-center justify-between active:scale-95">
                  <div className="font-black uppercase tracking-tight text-lg text-gray-900">{court.name}</div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600"><Play className="w-5 h-5 fill-current" /></div>
                </button>
              ))}
              <button onClick={handleOpenShopOnly} className="w-full p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between active:scale-95">
                <div className="font-black uppercase tracking-tight text-lg text-blue-900">BÁN LẺ DỊCH VỤ</div>
                <div className="bg-blue-600 p-2.5 rounded-xl text-white"><ShoppingBag className="w-5 h-5" /></div>
              </button>
            </div>
          </div>
        </div>
      )}

      <BookingModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} onConfirm={handleBookingConfirm} courts={COURTS} initialCourtId={pendingBooking?.courtId || 0} dateStr={selectedDate.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })} timeSlot={pendingBooking?.slot || null} allTimeSlots={TIME_SLOTS} checkAvailability={checkAvailability} />
      <BookingDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} booking={selectedBookingForDetail} products={products} onUpdateBooking={handleUpdateBooking} onCheckout={handleCheckout} />
      <ProductModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onConfirm={handleAddNewProductConfirm} />
    </div>
  );
};

export default App;
