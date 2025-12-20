
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateTimeSlots, formatDateKey, formatVND, cn, getStartOfWeek, getStartOfMonth, sendNotification } from './utils';
import { Booking, Court as CourtType, Product, BankConfig, SUPPORTED_BANKS } from './types';
import { Court } from './Court';
import { BookingModal } from './BookingModal';
import { BookingDetailModal } from './BookingDetailModal';
import { ProductModal } from './ProductModal';
import { Trash2, Trophy, ChevronLeft, ChevronRight, BarChart3, ShoppingBag, Plus, Calendar as CalendarIcon, Play, X, ShieldCheck, TrendingUp, Wallet, Package, Settings2, ArrowUpRight, Save, User as UserIcon, CheckCircle, BellRing, CloudLightning, RefreshCw, Smartphone, Bell, DownloadCloud, UploadCloud, AlertCircle } from 'lucide-react';

const COURTS: CourtType[] = [{ id: 1, name: 'Sân 1 (VIP)' }, { id: 2, name: 'Sân 2 (Thường)' }];
const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Nước suối', price: 10000, costPrice: 5000 },
  { id: '2', name: 'Revive', price: 15000, costPrice: 8000 },
  { id: '3', name: 'Cầu (Quả)', price: 20000, costPrice: 15000 }
];
const TIME_SLOTS = generateTimeSlots(6, 22);
// Sử dụng một bucket KVDB công khai và ổn định hơn
const SYNC_URL = 'https://kvdb.io/S3VzV1p4Z2h4Z2h4Z2h4/bad_pro_v6_';

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>(() => JSON.parse(localStorage.getItem('b-bookings') || '[]'));
  const [products, setProducts] = useState<Product[]>(() => JSON.parse(localStorage.getItem('b-prods') || JSON.stringify(DEFAULT_PRODUCTS)));
  const [bank, setBank] = useState<BankConfig>(() => JSON.parse(localStorage.getItem('b-bank') || '{"bankId":"mbb","accountNo":"","accountName":"","apiService":"none","apiKey":""}'));
  const [tempBank, setTempBank] = useState<BankConfig>(bank);
  
  const [syncId, setSyncId] = useState(() => localStorage.getItem('b-sync') || '');
  const [tmpSync, setTmpSync] = useState(syncId);
  const [syncSt, setSyncSt] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  
  const [tab, setTab] = useState<'calendar'|'shop'|'stats'|'settings'>('calendar');
  const [modals, setModals] = useState({ booking: false, detail: false, prod: false, quick: false });
  const [pending, setPending] = useState<any>(null);
  const [selB, setSelB] = useState<Booking | null>(null);
  const [period, setPeriod] = useState<'day'|'week'|'month'>('day');
  const [lastNotif, setLastNotif] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'default');

  const lockSync = useRef(false);
  const lastTimestamp = useRef(Number(localStorage.getItem('b-ts') || '0'));

  // Hàm đồng bộ dữ liệu (Push & Pull)
  const performSync = useCallback(async (targetId: string, mode: 'push' | 'pull' | 'auto') => {
    if (!targetId) return;
    
    setSyncSt('syncing');
    setSyncMsg(mode === 'push' ? 'Đang đẩy dữ liệu...' : 'Đang tải dữ liệu...');

    try {
      if (mode === 'push' || (mode === 'auto' && !lockSync.current)) {
        const newTs = Date.now();
        const payload = { bookings, prods: products, bank, timestamp: newTs };
        
        const res = await fetch(`${SYNC_URL}${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'cors'
        });

        if (!res.ok) throw new Error('Không thể lưu dữ liệu lên Cloud');
        
        lastTimestamp.current = newTs;
        localStorage.setItem('b-ts', newTs.toString());
        if (mode !== 'auto') alert('Đã đẩy dữ liệu lên thành công!');
      } 
      
      if (mode === 'pull' || mode === 'auto') {
        const res = await fetch(`${SYNC_URL}${targetId}?t=${Date.now()}`, { mode: 'cors', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.timestamp > lastTimestamp.current) {
            lockSync.current = true;
            
            // Nếu có đơn mới thì báo
            if (data.bookings.length > bookings.length) {
              setLastNotif("Hệ thống vừa cập nhật đơn mới!");
              sendNotification("Badminton Pro", "Dữ liệu đã được đồng bộ từ máy khác.");
            }

            setBookings(data.bookings);
            setProducts(data.prods);
            setBank(data.bank);
            lastTimestamp.current = data.timestamp;
            localStorage.setItem('b-ts', data.timestamp.toString());
            
            setTimeout(() => { lockSync.current = false; }, 2000);
            if (mode === 'pull') alert('Đã tải dữ liệu mới nhất!');
          } else if (mode === 'pull') {
            alert('Dữ liệu trên máy bạn đã là mới nhất!');
          }
        } else if (mode === 'pull') {
          throw new Error('Không tìm thấy dữ liệu trên Cloud');
        }
      }

      setSyncSt('success');
      setSyncMsg('Đã kết nối');
    } catch (err: any) {
      console.error(err);
      setSyncSt('error');
      setSyncMsg(err.message || 'Lỗi kết nối Cloud');
    }
  }, [bookings, products, bank]);

  // Auto Pull mỗi 10 giây
  useEffect(() => {
    if (!syncId) return;
    const interval = setInterval(() => performSync(syncId, 'auto'), 10000);
    return () => clearInterval(interval);
  }, [syncId, performSync]);

  // Auto Push khi có thay đổi (Debounced)
  useEffect(() => {
    localStorage.setItem('b-bookings', JSON.stringify(bookings));
    localStorage.setItem('b-prods', JSON.stringify(products));
    localStorage.setItem('b-bank', JSON.stringify(bank));

    if (syncId && !lockSync.current) {
      const timer = setTimeout(() => performSync(syncId, 'auto'), 2000);
      return () => clearTimeout(timer);
    }
  }, [bookings, products, bank, syncId]);

  const handleSaveSync = () => {
    const cleanId = tmpSync.trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleanId) return alert("Vui lòng nhập mã!");
    setSyncId(cleanId);
    localStorage.setItem('b-sync', cleanId);
    performSync(cleanId, 'pull'); // Thử tải ngay khi lưu mã
  };

  const dKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const onConfirm = useCallback((data: any) => {
    const groupId = data.selectedCourtIds.length > 1 ? Math.random().toString(36).slice(2, 8) : undefined;
    const newBookings: Booking[] = data.selectedCourtIds.map((courtId: number) => ({
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

  const stats = useMemo(() => {
    const now = new Date();
    const start = period === 'day' ? dKey : (period === 'week' ? formatDateKey(getStartOfWeek(now)) : formatDateKey(getStartOfMonth(now)));
    const filtered = bookings.filter(b => b.status === 'paid' && b.date >= start);
    const rev = filtered.reduce((a, b) => a + b.totalAmount, 0);
    const cost = filtered.reduce((a, b) => a + (b.serviceItems?.reduce((x, y) => x + (y.costPrice * y.quantity), 0) || 0), 0);
    return { rev, cost, prof: rev - cost, count: filtered.length };
  }, [bookings, period, dKey]);

  return (
    <div className="min-h-screen pb-28 bg-slate-50 font-inter text-slate-900">
      {lastNotif && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
              <div className="bg-emerald-950 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-3 border-2 border-emerald-400/50">
                  <BellRing className="w-5 h-5 text-emerald-400 animate-bounce" />
                  <p className="font-black text-xs uppercase flex-1">{lastNotif}</p>
                  <button onClick={() => setLastNotif(null)} className="p-1"><X className="w-4 h-4" /></button>
              </div>
          </div>
      )}

      <header className="bg-white border-b sticky top-0 z-40 p-4 safe-pt shadow-sm">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 p-2 rounded-xl text-white"><Trophy className="w-5 h-5" /></div>
            <div>
              <h1 className="font-black text-lg uppercase tracking-tighter leading-none">Badminton Pro</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", syncSt === 'success' ? 'bg-emerald-500' : syncSt === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-rose-500')}></span>
                <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">{syncId ? syncMsg : 'CHƯA ĐỒNG BỘ'}</p>
              </div>
            </div>
          </div>
          <button onClick={() => setModals(m => ({ ...m, quick: true }))} className="bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2">
            <Play className="w-3 h-3 fill-white" /> CHƠI NGAY
          </button>
        </div>
      </header>

      <main className="p-3 max-w-7xl mx-auto space-y-4">
        {tab === 'calendar' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-4 rounded-3xl flex items-center justify-between border shadow-sm">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-2 bg-slate-50 rounded-lg active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
              <div className="text-center">
                <p className="text-[9px] font-black text-emerald-700 uppercase mb-0.5">NGÀY THI ĐẤU</p>
                <h2 className="text-base font-black uppercase">{selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}</h2>
              </div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-2 bg-slate-50 rounded-lg active:scale-90"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-12">
              {COURTS.map(c => <Court key={c.id} court={c} bookings={bookings.filter(b => b.courtId === c.id && b.date === dKey && b.status === 'active')} timeSlots={TIME_SLOTS} onSlotClick={(ct, s) => { setPending({ courtId: ct, slot: s }); setModals(m => ({ ...m, booking: true })); }} onViewDetail={b => { setSelB(b); setModals(m => ({ ...m, detail: true })); }} />)}
            </div>
          </div>
        )}

        {tab === 'shop' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-black uppercase text-slate-950">Kho hàng</h2>
              <button onClick={() => setModals(m => ({ ...m, prod: true }))} className="bg-emerald-700 text-white p-2 rounded-xl shadow active:scale-95"><Plus className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {products.map(p => (
                <div key={p.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between group active:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-700"><ShoppingBag className="w-3 h-3" /></div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(confirm('Xóa?')) setProducts(products.filter(x => x.id !== p.id)); }} 
                      className="text-slate-300 hover:text-rose-500 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-black text-slate-800 uppercase text-[9px] leading-tight truncate">{p.name}</h3>
                    <p className="text-emerald-700 font-black text-[11px]">{formatVND(p.price).replace('₫', '')}</p>
                  </div>
                </div>
              ))}
              {products.length === 0 && <div className="col-span-full py-10 text-center opacity-30 text-[10px] font-black uppercase">Kho trống</div>}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase">Báo cáo</h2>
                <div className="bg-white p-1 rounded-xl border flex gap-1">
                    {(['day', 'week', 'month'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase", period === p ? "bg-emerald-700 text-white" : "text-slate-500")}>
                            {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : 'Tháng'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-emerald-950 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                <TrendingUp className="absolute -right-2 -bottom-2 w-20 h-20 opacity-10" />
                <p className="text-[9px] font-black text-emerald-400 uppercase mb-1">Lợi nhuận ròng</p>
                <p className="text-2xl font-black">{formatVND(stats.prof)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Doanh thu</p>
                <p className="text-lg font-black">{formatVND(stats.rev)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Thanh toán</p>
                <p className="text-lg font-black">{stats.count} đơn</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 max-w-2xl mx-auto pb-12 px-1">
            <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-5 shadow-xl border-b-4 border-emerald-900">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CloudLightning className="w-6 h-6 text-emerald-400" />
                    <h4 className="font-black uppercase text-base">Đồng bộ Cloud</h4>
                  </div>
                  {syncSt === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 animate-pulse" />}
               </div>

               <div className="flex gap-2">
                  <input 
                    value={tmpSync} 
                    onChange={e => setTmpSync(e.target.value)} 
                    className="flex-1 bg-white/10 border border-white/10 px-4 py-4 rounded-2xl font-black text-white outline-none focus:border-emerald-500 text-sm uppercase" 
                    placeholder="MÃ ĐỒNG BỘ..." 
                  />
                  <button onClick={handleSaveSync} className="bg-emerald-600 px-6 rounded-2xl active:scale-95"><Save className="w-5 h-5" /></button>
               </div>

               {syncId && (
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => performSync(syncId, 'push')} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-white/10 transition-all">
                       <UploadCloud className="w-4 h-4 text-emerald-400" /> Đẩy lên Cloud
                    </button>
                    <button onClick={() => performSync(syncId, 'pull')} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-white/10 transition-all">
                       <DownloadCloud className="w-4 h-4 text-blue-400" /> Tải từ Cloud
                    </button>
                 </div>
               )}

               <p className={cn("text-[9px] font-bold text-center uppercase tracking-widest px-2 py-2 rounded-lg", syncSt === 'error' ? 'bg-rose-500/20 text-rose-400' : 'text-white/40')}>
                  {syncSt === 'error' ? 'Lỗi: ' + syncMsg : 'Lưu ý: "Đẩy lên" sẽ ghi đè dữ liệu Cloud bằng dữ liệu máy này.'}
               </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border shadow-lg space-y-4">
              <h4 className="font-black uppercase text-sm ml-1">VietQR & Thông báo</h4>
              <div className="space-y-3">
                <button onClick={async () => { await Notification.requestPermission(); setNotifPerm(Notification.permission); alert('Đã cấp quyền!'); }} className="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 border-2 border-blue-100">
                  <Bell className="w-4 h-4" /> Bật thông báo đẩy ({notifPerm})
                </button>
                <select value={tempBank.bankId} onChange={e => setTempBank({...tempBank, bankId: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl font-bold text-xs outline-none">
                  {SUPPORTED_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="text" value={tempBank.accountNo} onChange={e => setTempBank({...tempBank, accountNo: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl font-bold text-xs" placeholder="SỐ TÀI KHOẢN..." />
                <input type="text" value={tempBank.accountName} onChange={e => setTempBank({...tempBank, accountName: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl font-bold text-xs" placeholder="TÊN KHÔNG DẤU..." />
                <button onClick={() => { setBank(tempBank); alert("Đã lưu!"); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs">Lưu ngân hàng</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center safe-pb rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
        {[
          { id: 'calendar', icon: CalendarIcon, l: 'Lịch' }, 
          { id: 'shop', icon: ShoppingBag, l: 'Kho' }, 
          { id: 'stats', icon: BarChart3, l: 'Báo cáo' },
          { id: 'settings', icon: Settings2, l: 'Cài đặt' }
        ].map(i => (
          <button key={i.id} onClick={() => setTab(i.id as any)} className={cn("flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all", tab === i.id ? "text-emerald-800 bg-emerald-50" : "text-slate-400")}>
            <i.icon className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase">{i.l}</span>
          </button>
        ))}
      </nav>

      {modals.quick && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-emerald-900 p-5 text-white flex justify-between items-center">
              <h3 className="font-black text-sm uppercase">Vào chơi nhanh</h3>
              <button onClick={() => setModals(m => ({...m, quick: false}))} className="p-1"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-2">
              {COURTS.map(c => (
                <button key={c.id} onClick={() => {
                  const now = new Date(); 
                  const h = now.getHours().toString().padStart(2, '0');
                  const m = now.getMinutes() < 30 ? '00' : '30';
                  const b: Booking = { 
                    id: Math.random().toString(36).slice(2, 8), courtId: c.id, date: dKey, timeSlot: `${h}:${m}`, actualStartTime: now.toISOString(), isLive: true, customerName: `KHÁCH SÂN ${c.id}`, phoneNumber: "CHƠI NGAY", totalAmount: 0, deposit: 0, remainingAmount: 0, serviceItems: [], status: 'active', durationSlots: 1 
                  };
                  setBookings(prev => [...prev, b]); setModals({ ...modals, quick: false });
                }} className="w-full p-5 bg-slate-50 border rounded-2xl font-black uppercase text-xs flex justify-between items-center hover:border-emerald-500">
                  {c.name}
                  <ArrowUpRight className="w-4 h-4 opacity-30" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BookingModal isOpen={modals.booking} onClose={() => setModals(m => ({ ...m, booking: false }))} onConfirm={onConfirm} courts={COURTS} initialCourtId={pending?.courtId || 0} dateStr={dKey} timeSlot={pending?.slot || null} allTimeSlots={TIME_SLOTS} checkAvailability={() => true} />
      <BookingDetailModal isOpen={modals.detail} onClose={() => setModals(m => ({ ...m, detail: false }))} booking={selB} products={products} bankConfig={bank} onUpdateBooking={(u) => setBookings(prev => prev.map(b => b.id === u.id ? u : b))} onCheckout={(b) => { setBookings(prev => prev.map(x => (x.id === b.id || x.groupId === b.groupId) ? { ...x, status: 'paid' as const } : x)); setModals(m => ({ ...m, detail: false })); }} />
      <ProductModal isOpen={modals.prod} onClose={() => setModals(m => ({ ...m, prod: false }))} onConfirm={p => setProducts(v => [...v, { ...p, id: Date.now().toString() }])} />
    </div>
  );
};
export default App;
