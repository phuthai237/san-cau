
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateTimeSlots, formatDateKey, formatVND, cn, getStartOfWeek, getStartOfMonth, sendNotification } from './utils';
import { Booking, Court as CourtType, Product, BankConfig, SUPPORTED_BANKS } from './types';
import { Court } from './Court';
import { BookingModal } from './BookingModal';
import { BookingDetailModal } from './BookingDetailModal';
import { ProductModal } from './ProductModal';
import { Trash2, Trophy, ChevronLeft, ChevronRight, BarChart3, ShoppingBag, Plus, Calendar as CalendarIcon, Play, X, ShieldCheck, TrendingUp, Wallet, Package, Settings2, ArrowUpRight, Save, User as UserIcon, CheckCircle, BellRing, CloudLightning, RefreshCw, Smartphone, Bell, DownloadCloud, UploadCloud, AlertCircle, RefreshCcw, Landmark, Share2, History, CloudCheck } from 'lucide-react';

const COURTS: CourtType[] = [{ id: 1, name: 'Sân 1 (VIP)' }, { id: 2, name: 'Sân 2 (Thường)' }];
const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Nước suối', price: 10000, costPrice: 5000 },
  { id: '2', name: 'Revive', price: 15000, costPrice: 8000 },
  { id: '3', name: 'Cầu (Quả)', price: 20000, costPrice: 15000 }
];
const TIME_SLOTS = generateTimeSlots(6, 22);

// SỬ DỤNG BUCKET CỐ ĐỊNH ĐỂ TRÁNH LỖI KHÔNG TÌM THẤY BUCKET
const CLOUD_BUCKET = '6vS8mB9z6q2q9q9q9q9q_badm_v5'; 

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
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => localStorage.getItem('b-last-sync') || 'Chưa kết nối');
  const [cloudHash, setCloudHash] = useState('');
  
  const [tab, setTab] = useState<'calendar'|'shop'|'stats'|'settings'>('calendar');
  const [modals, setModals] = useState({ booking: false, detail: false, prod: false, quick: false });
  const [pending, setPending] = useState<any>(null);
  const [selB, setSelB] = useState<Booking | null>(null);
  const [period, setPeriod] = useState<'day'|'week'|'month'>('day');

  const stateRef = useRef({ bookings, products, bank });
  useEffect(() => { stateRef.current = { bookings, products, bank }; }, [bookings, products, bank]);

  const lockSync = useRef(false);
  const lastTimestamp = useRef(Number(localStorage.getItem('b-ts') || '0'));

  const performSync = useCallback(async (targetId: string, mode: 'push' | 'pull' | 'force-pull') => {
    if (!targetId || lockSync.current) return;
    
    const cleanId = targetId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const fullUrl = `https://kvdb.io/${CLOUD_BUCKET}/${cleanId}`;

    if (mode !== 'pull' || syncSt !== 'success') {
        setSyncSt('syncing');
        setSyncMsg(mode === 'push' ? 'Đang gửi...' : 'Đang lấy...');
    }

    try {
      const checkRes = await fetch(`${fullUrl}?t=${Date.now()}`, { cache: 'no-store' });
      let cloudData: any = null;
      
      if (checkRes.ok) {
        cloudData = await checkRes.json();
      }

      // NẾU CLOUD TRỐNG -> TỰ ĐỘNG PUSH DỮ LIỆU HIỆN TẠI LÊN (Chỉ khi lần đầu kết nối)
      if (!cloudData && (mode === 'pull' || mode === 'force-pull')) {
        setSyncMsg('Khởi tạo Cloud...');
        const initTs = Date.now();
        const payload = JSON.stringify({ 
          bookings: stateRef.current.bookings, 
          prods: stateRef.current.products, 
          bank: stateRef.current.bank, 
          timestamp: initTs, 
          updatedAt: new Date().toISOString() 
        });
        await fetch(fullUrl, { method: 'PUT', body: payload });
        lastTimestamp.current = initTs;
        localStorage.setItem('b-ts', initTs.toString());
        setSyncSt('success');
        setSyncMsg('Đã kết nối mã');
        return;
      }

      // LẤY DỮ LIỆU VỀ
      if (mode === 'pull' || mode === 'force-pull') {
        if (mode === 'force-pull' || cloudData.timestamp > lastTimestamp.current) {
          lockSync.current = true;
          setBookings(cloudData.bookings || []);
          setProducts(cloudData.prods || DEFAULT_PRODUCTS);
          setBank(cloudData.bank || bank);
          lastTimestamp.current = cloudData.timestamp;
          localStorage.setItem('b-ts', cloudData.timestamp.toString());
          setCloudHash(cloudData.timestamp.toString().slice(-4));
          setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
          setSyncSt('success');
          setSyncMsg('Vừa cập nhật');
          setTimeout(() => { lockSync.current = false; }, 1000);
        } else {
          setSyncSt('success');
          setSyncMsg('Cloud Trực Tuyến');
          setCloudHash(cloudData.timestamp.toString().slice(-4));
        }
      }

      // ĐẨY DỮ LIỆU ĐI
      if (mode === 'push') {
        const newTs = Date.now();
        const payload = JSON.stringify({ 
          bookings: stateRef.current.bookings, 
          prods: stateRef.current.products, 
          bank: stateRef.current.bank, 
          timestamp: newTs, 
          updatedAt: new Date().toISOString() 
        });
        
        await fetch(fullUrl, { method: 'PUT', body: payload });
        lastTimestamp.current = newTs;
        localStorage.setItem('b-ts', newTs.toString());
        setCloudHash(newTs.toString().slice(-4));
        setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
        setSyncSt('success');
        setSyncMsg('Đã lưu Cloud');
      }
    } catch (err: any) {
      setSyncSt('error');
      setSyncMsg('Lỗi Cloud');
    }
  }, [bank]);

  // Tự động kiểm tra Cloud mỗi 6 giây
  useEffect(() => {
    if (!syncId) return;
    performSync(syncId, 'pull');
    const interval = setInterval(() => performSync(syncId, 'pull'), 6000);
    return () => clearInterval(interval);
  }, [syncId, performSync]);

  useEffect(() => {
    localStorage.setItem('b-bookings', JSON.stringify(bookings));
    localStorage.setItem('b-prods', JSON.stringify(products));
    localStorage.setItem('b-bank', JSON.stringify(bank));
    localStorage.setItem('b-last-sync', lastSyncTime);
  }, [bookings, products, bank, lastSyncTime]);

  const stats = useMemo(() => {
    const now = new Date();
    let start: Date;
    if (period === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      start = getStartOfWeek(now);
      start.setHours(0, 0, 0, 0);
    } else {
      start = getStartOfMonth(now);
      start.setHours(0, 0, 0, 0);
    }

    const filtered = bookings.filter(b => {
      if (b.status !== 'paid') return false;
      const [y, m, d] = b.date.split('-').map(Number);
      const bDate = new Date(y, m - 1, d);
      return bDate >= start;
    });

    const rev = filtered.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
    const serviceCost = filtered.reduce((acc, b) => {
      const itemsCost = (b.serviceItems || []).reduce((sAcc, s) => sAcc + ((s.costPrice || 0) * (s.quantity || 0)), 0);
      return acc + itemsCost;
    }, 0);

    return { rev, prof: rev - serviceCost };
  }, [bookings, period]);

  const onConfirm = useCallback((data: any) => {
    const groupId = data.selectedCourtIds.length > 1 ? Math.random().toString(36).slice(2, 8) : undefined;
    const newBookings: Booking[] = data.selectedCourtIds.map((courtId: number) => ({
      id: Math.random().toString(36).slice(2, 8),
      courtId,
      date: formatDateKey(selectedDate),
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
    if (syncId) setTimeout(() => performSync(syncId, 'push'), 500);
  }, [selectedDate, pending, syncId, performSync]);

  const handleCheckout = (b: Booking, finalValue: number) => {
    setBookings(prev => prev.map(x => {
      if (x.id === b.id || (b.groupId && x.groupId === b.groupId)) {
        const sTot = (x.serviceItems || []).reduce((a, s) => a + (s.price * s.quantity), 0);
        // TIỀN SÂN: 1K/PHÚT CHO LIVE, 30K/SLOT CHO ĐẶT TRƯỚC
        const cTot = x.isLive ? finalValue * 1000 : finalValue * 30000;
        return { 
          ...x, 
          status: 'paid' as const, 
          durationSlots: x.isLive ? Math.ceil(finalValue / 30) : finalValue,
          totalAmount: cTot + sTot,
          remainingAmount: 0
        };
      }
      return x;
    }));
    setModals(m => ({ ...m, detail: false }));
    if (syncId) setTimeout(() => performSync(syncId, 'push'), 500);
  };

  return (
    <div className="min-h-screen pb-28 bg-slate-50 font-inter text-slate-900">
      <header className="bg-white border-b sticky top-0 z-40 p-4 safe-pt shadow-sm">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 p-2 rounded-xl text-white shadow-lg shadow-emerald-100"><Trophy className="w-5 h-5" /></div>
            <div>
              <h1 className="font-black text-lg uppercase tracking-tighter leading-none">Badminton Pro</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", syncSt === 'success' ? 'bg-emerald-500' : syncSt === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-rose-500')}></span>
                <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">{syncId ? `${syncMsg} #${cloudHash}` : 'CHƯA CÀI MÃ'}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => syncId && performSync(syncId, 'pull')} className="bg-slate-100 p-2.5 rounded-xl active:scale-90 transition-all border border-slate-200">
               <RefreshCcw className={cn("w-4 h-4 text-slate-500", syncSt === 'syncing' && "animate-spin")} />
            </button>
            <button onClick={() => setModals(m => ({ ...m, quick: true }))} className="bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2 active:scale-95 shadow-md shadow-emerald-50">
              <Play className="w-3 h-3 fill-white" /> CHƠI NGAY
            </button>
          </div>
        </div>
      </header>

      <main className="p-3 max-w-7xl mx-auto space-y-4">
        {tab === 'calendar' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-4 rounded-3xl flex items-center justify-between border shadow-sm">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-2 bg-slate-50 rounded-lg active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
              <div className="text-center">
                <p className="text-[9px] font-black text-emerald-700 uppercase mb-0.5 tracking-widest">LỊCH THI ĐẤU</p>
                <h2 className="text-base font-black uppercase">{selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}</h2>
              </div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-2 bg-slate-50 rounded-lg active:scale-90"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-12">
              {COURTS.map(c => <Court key={c.id} court={c} bookings={bookings.filter(b => b.courtId === c.id && b.date === formatDateKey(selectedDate) && b.status === 'active')} timeSlots={TIME_SLOTS} onSlotClick={(ct, s) => { setPending({ courtId: ct, slot: s }); setModals(m => ({ ...m, booking: true })); }} onViewDetail={b => { setSelB(b); setModals(m => ({ ...m, detail: true })); }} />)}
            </div>
          </div>
        )}

        {tab === 'shop' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 px-1">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black uppercase text-slate-950">Kho hàng</h2>
              <button onClick={() => setModals(m => ({ ...m, prod: true }))} className="bg-emerald-700 text-white p-2 rounded-xl shadow active:scale-95"><Plus className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2">
              {products.map(p => (
                <div key={p.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-24">
                  <div className="flex justify-between items-start">
                    <div className="bg-emerald-50 p-1 rounded-lg text-emerald-700"><ShoppingBag className="w-2.5 h-2.5" /></div>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Xóa?')) { setProducts(products.filter(x => x.id !== p.id)); if(syncId) setTimeout(() => performSync(syncId, 'push'), 500); } }} className="text-slate-200 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    <h3 className="font-black text-slate-800 uppercase text-[8px] leading-tight truncate">{p.name}</h3>
                    <p className="text-emerald-700 font-black text-[10px]">{formatVND(p.price).replace('₫', '')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
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
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-6 max-w-2xl mx-auto pb-12 px-1">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white space-y-6 shadow-2xl border-b-8 border-slate-950">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/20 p-2 rounded-xl"><CloudCheck className="w-6 h-6 text-emerald-400" /></div>
                    <h4 className="font-black uppercase text-base tracking-tight">Sync 2 Máy</h4>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase text-emerald-400/60 bg-white/5 px-3 py-1.5 rounded-full">
                      <History className="w-3 h-3" /> {lastSyncTime}
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex gap-2 relative">
                    <input 
                      value={tmpSync} 
                      onChange={e => setTmpSync(e.target.value)} 
                      className="flex-1 bg-white/5 border border-white/10 px-5 py-5 rounded-2xl font-black text-white outline-none focus:border-emerald-500 transition-all text-sm" 
                      placeholder="MÃ ĐỒNG BỘ..." 
                    />
                    <button onClick={() => {
                        const cleanId = tmpSync.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (cleanId.length < 4) return alert("Mã cần ít nhất 4 ký tự!");
                        setSyncId(cleanId);
                        localStorage.setItem('b-sync', cleanId);
                        performSync(cleanId, 'force-pull');
                    }} className="bg-emerald-600 px-6 rounded-2xl active:scale-95 shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all"><Save className="w-5 h-5" /></button>
                  </div>
                  <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] text-center italic">Nhập cùng 1 mã trên các thiết bị để đồng bộ</p>
               </div>

               <div className="grid grid-cols-2 gap-4 pt-2">
                    <button onClick={() => performSync(syncId, 'push')} className="group flex flex-col items-center justify-center gap-2 bg-emerald-600/10 border border-emerald-500/30 py-6 rounded-[2rem] font-black text-[9px] uppercase hover:bg-emerald-600 hover:text-white transition-all active:scale-95">
                       <UploadCloud className="w-6 h-6 mb-1" /> Lưu lên Cloud
                    </button>
                    <button onClick={() => performSync(syncId, 'force-pull')} className="group flex flex-col items-center justify-center gap-2 bg-blue-600/10 border border-blue-500/30 py-6 rounded-[2rem] font-black text-[9px] uppercase hover:bg-blue-600 hover:text-white transition-all active:scale-95">
                       <DownloadCloud className="w-6 h-6 mb-1" /> Buộc cập nhật
                    </button>
               </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border shadow-lg space-y-5">
              <h4 className="font-black uppercase text-sm ml-1 text-slate-900 tracking-tight flex items-center gap-2"><Landmark className="w-5 h-5 text-emerald-600" /> Ngân hàng & VietQR</h4>
              <div className="space-y-3">
                <select value={tempBank.bankId} onChange={e => setTempBank({...tempBank, bankId: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-xs outline-none focus:border-emerald-500">
                  {SUPPORTED_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="text" value={tempBank.accountNo} onChange={e => setTempBank({...tempBank, accountNo: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-xs" placeholder="SỐ TÀI KHOẢN..." />
                <input type="text" value={tempBank.accountName} onChange={e => setTempBank({...tempBank, accountName: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-2xl font-bold text-xs" placeholder="TÊN TÀI KHOẢN (KHÔNG DẤU)..." />
                <button onClick={() => { setBank(tempBank); if(syncId) performSync(syncId, 'push'); alert("Đã lưu thông tin ngân hàng!"); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs active:scale-95 shadow-xl">Cập nhật ngân hàng</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {modals.quick && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl border-4 border-white animate-in zoom-in-95">
            <div className="bg-emerald-900 p-6 text-white flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-widest">Vào chơi nhanh</h3>
              <button onClick={() => setModals(m => ({...m, quick: false}))} className="p-2 bg-white/10 rounded-xl active:scale-90"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-3 bg-slate-50">
              {COURTS.map(c => (
                <button key={c.id} onClick={() => {
                  const now = new Date(); 
                  const h = now.getHours().toString().padStart(2, '0');
                  const m = now.getMinutes() < 30 ? '00' : '30';
                  const b: Booking = { 
                    id: Math.random().toString(36).slice(2, 8), courtId: c.id, date: formatDateKey(selectedDate), timeSlot: `${h}:${m}`, actualStartTime: now.toISOString(), isLive: true, customerName: `KHÁCH SÂN ${c.id}`, phoneNumber: "TRỰC TIẾP", totalAmount: 0, deposit: 0, remainingAmount: 0, serviceItems: [], status: 'active', durationSlots: 1 
                  };
                  setBookings(prev => [...prev, b]); 
                  setModals({ ...modals, quick: false });
                  if(syncId) setTimeout(() => performSync(syncId, 'push'), 500);
                }} className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2rem] font-black uppercase text-xs flex justify-between items-center hover:border-emerald-500 active:scale-95 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all"><Trophy className="w-5 h-5" /></div>
                    {c.name}
                  </div>
                  <ArrowUpRight className="w-4 h-4 opacity-30" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center safe-pb rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.08)] z-50">
        {[
          { id: 'calendar', icon: CalendarIcon, l: 'Lịch' }, 
          { id: 'shop', icon: ShoppingBag, l: 'Kho' }, 
          { id: 'stats', icon: BarChart3, l: 'Báo cáo' },
          { id: 'settings', icon: Settings2, l: 'Cài đặt' }
        ].map(i => (
          <button key={i.id} onClick={() => setTab(i.id as any)} className={cn("flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl transition-all", tab === i.id ? "text-emerald-800 bg-emerald-50 shadow-inner" : "text-slate-400")}>
            <i.icon className={cn("w-4 h-4", tab === i.id && "fill-emerald-800/10")} />
            <span className="text-[8px] font-black uppercase tracking-widest">{i.l}</span>
          </button>
        ))}
      </nav>

      <BookingModal isOpen={modals.booking} onClose={() => setModals(m => ({ ...m, booking: false }))} onConfirm={onConfirm} courts={COURTS} initialCourtId={pending?.courtId || 0} dateStr={formatDateKey(selectedDate)} timeSlot={pending?.slot || null} allTimeSlots={TIME_SLOTS} checkAvailability={() => true} />
      <BookingDetailModal isOpen={modals.detail} onClose={() => setModals(m => ({ ...m, detail: false }))} booking={selB} products={products} bankConfig={bank} onUpdateBooking={(u) => { setBookings(prev => prev.map(b => b.id === u.id ? u : b)); if(syncId) setTimeout(() => performSync(syncId, 'push'), 1000); }} onCheckout={handleCheckout} />
      <ProductModal isOpen={modals.prod} onClose={() => setModals(m => ({ ...m, prod: false }))} onConfirm={p => { setProducts(v => [...v, { ...p, id: Date.now().toString() }]); if(syncId) setTimeout(() => performSync(syncId, 'push'), 500); }} />
    </div>
  );
};
export default App;
