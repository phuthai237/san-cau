import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateTimeSlots, formatDateKey, formatVND, cn, getStartOfWeek, getStartOfMonth, sendNotification } from './utils';
import { Booking, Court as CourtType, Product, BankConfig, SUPPORTED_BANKS } from './types';
import { Court } from './Court';
import { BookingModal } from './BookingModal';
import { BookingDetailModal } from './BookingDetailModal';
import { ProductModal } from './ProductModal';
import { Trash2, Trophy, ChevronLeft, ChevronRight, BarChart3, ShoppingBag, Plus, Calendar as CalendarIcon, Play, X, ShieldCheck, TrendingUp, Wallet, Package, Settings2, ArrowUpRight, Save, User as UserIcon, CheckCircle, BellRing, CloudLightning } from 'lucide-react';

const COURTS: CourtType[] = [{ id: 1, name: 'Sân 1 (VIP)' }, { id: 2, name: 'Sân 2 (Thường)' }];
const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Nước suối', price: 10000, costPrice: 5000 },
  { id: '2', name: 'Revive', price: 15000, costPrice: 8000 },
  { id: '3', name: 'Cầu (Quả)', price: 20000, costPrice: 15000 }
];
const TIME_SLOTS = generateTimeSlots(6, 22);
const SYNC_URL = 'https://kvdb.io/S3VzV1p4Z2h4Z2h4Z2h4/bad_v3_';

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>(() => JSON.parse(localStorage.getItem('b-bookings') || '[]'));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('b-prods') || JSON.stringify(DEFAULT_PRODUCTS)));
  const [bank, setBank] = useState<BankConfig>(() => JSON.parse(localStorage.getItem('b-bank') || '{"bankId":"mbb","accountNo":"","accountName":"","apiService":"none","apiKey":""}'));
  const [tempBank, setTempBank] = useState<BankConfig>(bank);
  const [syncId, setSyncId] = useState(localStorage.getItem('b-sync') || '');
  const [tmpSync, setTmpSync] = useState(syncId);
  const [syncSt, setSyncSt] = useState('idle');
  const [tab, setTab] = useState<'calendar'|'shop'|'stats'|'settings'>('calendar');
  const [modals, setModals] = useState({ booking: false, detail: false, prod: false, quick: false });
  const [pending, setPending] = useState<any>(null);
  const [selB, setSelB] = useState<Booking | null>(null);
  const [period, setPeriod] = useState<'day'|'week'|'month'>('day');
  const [lastNotif, setLastNotif] = useState<string | null>(null);

  const lock = useRef(false);
  const ts = useRef(Number(localStorage.getItem('b-ts') || '0'));

  // Lưu local và đồng thời PUSH lên cloud nếu có thay đổi
  useEffect(() => {
    localStorage.setItem('b-bookings', JSON.stringify(bookings));
    localStorage.setItem('b-prods', JSON.stringify(products));
    localStorage.setItem('b-bank', JSON.stringify(bank));
    localStorage.setItem('b-ts', ts.current.toString());

    if (syncId && !lock.current) {
        sync(true);
    }
  }, [bookings, products, bank]);

  const sync = useCallback(async (isPush = false) => {
    if (!syncId || lock.current) return;
    try {
      setSyncSt('syncing');
      if (isPush) {
        ts.current = Date.now();
        await fetch(`${SYNC_URL}${syncId}`, { 
            method: 'PUT', 
            body: JSON.stringify({ bookings, prods: products, bank, timestamp: ts.current }) 
        });
      } else {
        const r = await fetch(`${SYNC_URL}${syncId}?t=${Date.now()}`);
        if (r.ok) {
          const d = await r.json();
          if (d.timestamp > ts.current) {
            ts.current = d.timestamp; 
            lock.current = true;
            
            // So sánh để thông báo
            if (d.bookings.length > bookings.length) {
                setLastNotif("Có đơn đặt sân mới từ thiết bị khác!");
                sendNotification("Thông báo Sân Cầu", "Vừa có lịch đặt sân mới được cập nhật!");
            } else if (d.bookings.some((b: any, i: number) => b.status !== (bookings[i]?.status))) {
                setLastNotif("Dữ liệu thanh toán đã được cập nhật!");
            }

            setBookings(d.bookings); 
            setProducts(d.prods); 
            setBank(d.bank);
            
            setTimeout(() => {
                lock.current = false;
                setTimeout(() => setLastNotif(null), 5000);
            }, 1000);
          }
        }
      }
      setSyncSt('success');
    } catch (e) { 
        setSyncSt('error'); 
    }
  }, [syncId, bookings, products, bank]);

  // Kiểm tra cập nhật mỗi 5 giây (nhanh hơn để mượt mà)
  useEffect(() => { 
    if(syncId) { 
        const i = setInterval(() => sync(false), 5000); 
        return () => clearInterval(i); 
    } 
  }, [syncId, sync]);

  const dKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const onConfirm = useCallback((data: {
    name: string;
    phone: string;
    durationSlots: number;
    selectedCourtIds: number[];
    totalAmount: number;
    deposit: number;
  }) => {
    const groupId = data.selectedCourtIds.length > 1 ? Math.random().toString(36).slice(2, 8) : undefined;
    const newBookings: Booking[] = data.selectedCourtIds.map(courtId => ({
      id: Math.random().toString(36).slice(2, 8),
      courtId,
      date: dKey,
      timeSlot: pending?.slot.time || '',
      customerName: data.name,
      phoneNumber: data.phone,
      totalAmount: data.totalAmount / data.selectedCourtIds.length,
      deposit: data.deposit / data.selectedCourtIds.length,
      remainingAmount: (data.totalAmount - data.deposit) / data.selectedCourtIds.length,
      status: 'active' as const,
      durationSlots: data.durationSlots,
      groupId,
      serviceItems: []
    }));
    setBookings(prev => [...prev, ...newBookings]);
    setModals(m => ({ ...m, booking: false }));
  }, [dKey, pending]);

  const onUpdateB = useCallback((updated: Booking) => {
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    setSelB(updated); 
  }, []);

  const saveBankSettings = () => {
    setBank(tempBank);
    alert("Đã lưu cấu hình tài khoản!");
  };
  
  const stats = useMemo(() => {
    const now = new Date();
    const start = period === 'day' ? dKey : (period === 'week' ? formatDateKey(getStartOfWeek(now)) : formatDateKey(getStartOfMonth(now)));
    const filtered = bookings.filter(b => b.status === 'paid' && b.date >= start);
    const rev = filtered.reduce((a, b) => a + b.totalAmount, 0);
    const cost = filtered.reduce((a, b) => a + (b.serviceItems?.reduce((x, y) => x + (y.costPrice * y.quantity), 0) || 0), 0);
    return { rev, cost, prof: rev - cost, count: filtered.length };
  }, [bookings, period, dKey]);

  return (
    <div className="min-h-screen pb-24 bg-slate-100 font-inter text-slate-900">
      {/* Toast Notification for Cloud Sync */}
      {lastNotif && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-top duration-500">
              <div className="bg-emerald-950 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-emerald-500/50 backdrop-blur-md">
                  <div className="bg-emerald-500 p-2 rounded-xl animate-bounce">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <p className="font-black text-xs uppercase tracking-tight flex-1">{lastNotif}</p>
                  <button onClick={() => setLastNotif(null)} className="p-1 opacity-50"><X className="w-4 h-4" /></button>
              </div>
          </div>
      )}

      <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-40 p-4 safe-pt shadow-lg">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 p-2.5 rounded-2xl text-white shadow-xl shadow-emerald-200"><Trophy className="w-6 h-6" /></div>
            <div>
              <h1 className="font-black text-2xl uppercase tracking-tighter leading-none text-emerald-950">Badminton Pro</h1>
              <p className={cn("text-[11px] font-black uppercase mt-1 flex items-center gap-1.5", syncSt === 'success' ? "text-blue-700" : "text-slate-500")}>
                {syncSt === 'syncing' ? <CloudLightning className="w-3 h-3 animate-pulse" /> : '●'} 
                {syncSt === 'success' ? 'Đã đồng bộ' : syncSt === 'syncing' ? 'Đang gửi...' : 'Chế độ Offline'}
              </p>
            </div>
          </div>
          <button onClick={() => setModals(m => ({ ...m, quick: true }))} className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-2xl font-black text-xs flex gap-2 shadow-xl active:scale-95 transition-all">
            <Play className="w-4 h-4 fill-white" /> CHƠI NGAY
          </button>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        {tab === 'calendar' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-5 rounded-[2.5rem] flex items-center justify-between shadow-md border-2 border-slate-200">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-3 bg-slate-100 rounded-2xl text-slate-900 hover:bg-slate-200 active:scale-90 transition-all"><ChevronLeft className="w-7 h-7" /></button>
              <div className="text-center">
                <p className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.3em] mb-1">LỊCH THI ĐẤU</p>
                <h2 className="text-2xl font-black uppercase text-slate-950">{selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              </div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-3 bg-slate-100 rounded-2xl text-slate-900 hover:bg-slate-200 active:scale-90 transition-all"><ChevronRight className="w-7 h-7" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {COURTS.map(c => <Court key={c.id} court={c} bookings={bookings.filter(b => b.courtId === c.id && b.date === dKey && b.status === 'active')} timeSlots={TIME_SLOTS} onSlotClick={(ct, s) => { setPending({ courtId: ct, slot: s }); setModals(m => ({ ...m, booking: true })); }} onViewDetail={b => { setSelB(b); setModals(m => ({ ...m, detail: true })); }} />)}
            </div>
          </div>
        )}

        {tab === 'shop' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-3xl font-black uppercase text-slate-950 flex items-center gap-4"><Package className="text-emerald-700 w-10 h-10" /> Kho hàng</h2>
              <button onClick={() => setModals(m => ({ ...m, prod: true }))} className="bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black text-xs flex gap-2 shadow-xl active:scale-95 transition-all"><Plus className="w-6 h-6" /> THÊM MỚI</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map(p => (
                <div key={p.id} className="bg-white p-7 rounded-[2.5rem] border-2 border-slate-200 shadow-md hover:shadow-xl transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-emerald-50 p-5 rounded-3xl text-emerald-800 shadow-inner border border-emerald-100"><ShoppingBag className="w-7 h-7" /></div>
                      <button onClick={() => setProducts(products.filter(x => x.id !== p.id))} className="text-slate-400 hover:text-rose-600 p-2.5 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 className="w-6 h-6" /></button>
                    </div>
                    <h3 className="font-black text-slate-950 uppercase text-lg mb-1 leading-tight">{p.name}</h3>
                    <p className="text-emerald-700 font-black text-2xl">{formatVND(p.price)}</p>
                  </div>
                  <div className="mt-8 pt-6 border-t-2 border-slate-50 flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Vốn: {formatVND(p.costPrice)}</span>
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">Lãi: {formatVND(p.price - p.costPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row gap-6 items-center justify-between px-2">
              <h2 className="text-3xl font-black uppercase text-slate-950 flex items-center gap-4"><BarChart3 className="text-emerald-700 w-10 h-10" /> Thống kê</h2>
              <div className="bg-white p-2 rounded-[1.5rem] border-2 border-slate-200 flex gap-1 shadow-md">
                {(['day', 'week', 'month'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)} className={cn("px-8 py-3.5 rounded-2xl text-xs font-black uppercase transition-all", period === p ? "bg-emerald-700 text-white shadow-xl" : "text-slate-600 hover:bg-slate-100")}>
                    {p === 'day' ? 'Hôm nay' : p === 'week' ? 'Tuần này' : 'Tháng này'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-emerald-950 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                <TrendingUp className="absolute right-[-10%] bottom-[-10%] w-48 h-48 opacity-10 group-hover:scale-110 transition-transform duration-1000" />
                <p className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-3">Lợi nhuận ròng</p>
                <p className="text-6xl font-black tabular-nums tracking-tighter mb-6 drop-shadow-lg">{formatVND(stats.prof)}</p>
                <div className="flex items-center gap-2 text-xs font-black bg-white/10 w-fit px-5 py-2 rounded-full border border-white/20 uppercase tracking-widest">
                  <ArrowUpRight className="w-4 h-4" /> {stats.count} đơn đã thanh toán
                </div>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-md flex flex-col justify-between">
                <div>
                  <div className="bg-blue-100 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-blue-800 mb-8 shadow-inner border border-blue-200"><TrendingUp className="w-8 h-8" /></div>
                  <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Tổng doanh thu</p>
                  <p className="text-4xl font-black text-slate-950 tabular-nums">{formatVND(stats.rev)}</p>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-md flex flex-col justify-between">
                <div>
                  <div className="bg-rose-100 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-rose-800 mb-8 shadow-inner border border-rose-200"><Wallet className="w-8 h-8" /></div>
                  <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Tổng tiền vốn</p>
                  <p className="text-4xl font-black text-rose-700 tabular-nums">{formatVND(stats.cost)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
               <div className="w-24 h-24 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center shadow-inner border-4 border-white">
                  <UserIcon className="w-12 h-12" />
               </div>
               <h2 className="text-3xl font-black uppercase text-slate-950">Thông tin tài khoản</h2>
               <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Cấu hình nhận thanh toán VietQR</p>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-xl space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-950 uppercase ml-2 tracking-widest">Ngân hàng thụ hưởng</label>
                  <select 
                    value={tempBank.bankId} 
                    onChange={e => setTempBank({...tempBank, bankId: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-slate-950 focus:border-emerald-700 outline-none shadow-sm transition-all"
                  >
                    {SUPPORTED_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-950 uppercase ml-2 tracking-widest">Số tài khoản</label>
                  <input 
                    type="text"
                    value={tempBank.accountNo} 
                    onChange={e => setTempBank({...tempBank, accountNo: e.target.value})} 
                    className="w-full bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-slate-950 focus:border-emerald-700 outline-none shadow-sm transition-all" 
                    placeholder="SỐ TÀI KHOẢN NGÂN HÀNG..." 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-950 uppercase ml-2 tracking-widest">Tên chủ tài khoản</label>
                  <input 
                    type="text"
                    value={tempBank.accountName} 
                    onChange={e => setTempBank({...tempBank, accountName: e.target.value})} 
                    className="w-full bg-slate-50 border-2 border-slate-200 p-5 rounded-2xl font-black text-slate-950 focus:border-emerald-700 outline-none shadow-sm transition-all placeholder:opacity-30" 
                    placeholder="TÊN KHÔNG DẤU (VD: NGUYEN VAN A)..." 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={saveBankSettings} 
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-6 rounded-3xl font-black text-sm flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all uppercase tracking-widest"
                >
                  <Save className="w-6 h-6" /> Lưu thay đổi
                </button>
              </div>
            </div>
            
            <div className="bg-slate-950 p-8 rounded-[3rem] text-white space-y-4 shadow-xl">
               <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h4 className="font-black uppercase text-sm">Đồng bộ dữ liệu Cloud</h4>
               </div>
               <p className="text-[11px] text-white/40 uppercase font-black px-2">Nhập mã bất kỳ để kết nối các điện thoại</p>
               <div className="flex gap-4">
                  <input 
                    value={tmpSync} 
                    onChange={e => setTmpSync(e.target.value.toUpperCase())} 
                    className="flex-1 bg-white/10 border-2 border-white/20 p-4 rounded-2xl font-black text-white outline-none focus:border-emerald-500 transition-all placeholder:text-white/20" 
                    placeholder="VÍ DỤ: SAN-CAU-LONG-A" 
                  />
                  <button 
                    onClick={() => { setSyncId(tmpSync); localStorage.setItem('b-sync', tmpSync); alert("Đã áp dụng mã đồng bộ!"); }} 
                    className="bg-emerald-600 px-6 rounded-2xl hover:bg-emerald-500 transition-all active:scale-90"
                  >
                    <CheckCircle className="w-6 h-6" />
                  </button>
               </div>
               <p className="text-[10px] text-emerald-400/60 font-bold uppercase leading-relaxed italic px-2">Dữ liệu sẽ tự động cập nhật và thông báo khi có người đặt sân trên máy khác.</p>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 p-4 flex justify-around items-center safe-pb rounded-t-[3rem] shadow-[0_-15px_50px_rgba(0,0,0,0.15)] z-50">
        {[
          { id: 'calendar', icon: CalendarIcon, l: 'Lịch sân' }, 
          { id: 'shop', icon: ShoppingBag, l: 'Dịch vụ' }, 
          { id: 'stats', icon: BarChart3, l: 'Báo cáo' },
          { id: 'settings', icon: UserIcon, l: 'Tài khoản' }
        ].map(i => (
          <button key={i.id} onClick={() => setTab(i.id as any)} className={cn("flex flex-col items-center gap-2 px-6 py-4 rounded-[2rem] transition-all flex-1 mx-1", tab === i.id ? "text-emerald-800 bg-emerald-50 shadow-inner" : "text-slate-400 hover:text-slate-600")}>
            <i.icon className={cn("w-6 h-6 transition-transform", tab === i.id ? "scale-110" : "")} />
            <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">{i.l}</span>
          </button>
        ))}
      </nav>

      {modals.quick && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-emerald-900 p-8 text-white flex justify-between items-center">
              <h3 className="font-black text-xl uppercase tracking-tight">Chọn sân để chơi</h3>
              <button onClick={() => setModals(m => ({...m, quick: false}))} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-6 h-6"/></button>
            </div>
            <div className="p-8 space-y-4">
              {COURTS.map(c => (
                <button key={c.id} onClick={() => {
                  const now = new Date(); 
                  const hour = now.getHours().toString().padStart(2, '0');
                  const minute = now.getMinutes() < 30 ? '00' : '30';
                  const timeStr = `${hour}:${minute}`;
                  
                  const b: Booking = { 
                    id: Math.random().toString(36).slice(2, 8), 
                    courtId: c.id, 
                    date: dKey, 
                    timeSlot: timeStr, 
                    actualStartTime: now.toISOString(), 
                    isLive: true, 
                    customerName: `KHÁCH SÂN ${c.id}`, 
                    phoneNumber: "VÀO CHƠI NGAY", 
                    totalAmount: 0, 
                    deposit: 0, 
                    remainingAmount: 0, 
                    serviceItems: [], 
                    status: 'active', 
                    durationSlots: 1 
                  };
                  setBookings(prev => [...prev, b]); 
                  setModals({ ...modals, quick: false });
                }} className="w-full p-6 bg-slate-50 border-2 border-slate-200 rounded-3xl font-black uppercase text-slate-800 hover:border-emerald-600 hover:bg-emerald-50 transition-all active:scale-95 shadow-sm text-lg">
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BookingModal isOpen={modals.booking} onClose={() => setModals(m => ({ ...m, booking: false }))} onConfirm={onConfirm} courts={COURTS} initialCourtId={pending?.courtId || 0} dateStr={dKey} timeSlot={pending?.slot || null} allTimeSlots={TIME_SLOTS} checkAvailability={() => true} />
      <BookingDetailModal isOpen={modals.detail} onClose={() => setModals(m => ({ ...m, detail: false }))} booking={selB} products={products} bankConfig={bank} onUpdateBooking={onUpdateB} onCheckout={(b) => { setBookings(p => p.map(x => (x.id === b.id || x.groupId === b.groupId) ? { ...x, status: 'paid' } : x)); setModals(m => ({ ...m, detail: false })); }} />
      <ProductModal isOpen={modals.prod} onClose={() => setModals(m => ({ ...m, prod: false }))} onConfirm={p => setProducts(v => [...v, { ...p, id: Date.now().toString() }])} />
    </div>
  );
};
export default App;