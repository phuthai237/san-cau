
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { generateTimeSlots, formatDateKey, formatVND, cn, getStartOfWeek, getStartOfMonth } from './utils';
import { Booking, Court as CourtType, Product, BankConfig, SUPPORTED_BANKS } from './types';
import { Court } from './Court';
import { BookingModal } from './BookingModal';
import { BookingDetailModal } from './BookingDetailModal';
import { ProductModal } from './ProductModal';
import { Trash2, Trophy, ChevronLeft, ChevronRight, BarChart3, ShoppingBag, Plus, Calendar as CalendarIcon, Play, X, ShieldCheck, TrendingUp, Wallet, Package, Settings2, ArrowUpRight, Save, User as UserIcon, CheckCircle, BellRing, CloudLightning, RefreshCw, Smartphone, Bell, DownloadCloud, UploadCloud, AlertCircle, RefreshCcw, Landmark, Share2, History, CloudCheck, Wifi, WifiOff, Globe, Signal, SignalHigh, SignalLow, Zap, Activity, ShieldAlert, WifiHigh, Radio, Terminal } from 'lucide-react';

const COURTS: CourtType[] = [{ id: 1, name: 'Sân 1 (VIP)' }, { id: 2, name: 'Sân 2 (Thường)' }];
const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Nước suối', price: 10000, costPrice: 5000 },
  { id: '2', name: 'Revive', price: 15000, costPrice: 8000 },
  { id: '3', name: 'Cầu (Quả)', price: 20000, costPrice: 15000 }
];
const TIME_SLOTS = generateTimeSlots(6, 22);

// BUCKET V15 - PHIÊN BẢN TỰ ĐỘNG KHỞI TẠO (FIX LỖI 404)
const CLOUD_BUCKET = 'badm_v15_resilient'; 

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try { return JSON.parse(localStorage.getItem('b-bookings') || '[]'); } catch { return []; }
  });
  const [products, setProducts] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem('b-prods') || JSON.stringify(DEFAULT_PRODUCTS)); } catch { return DEFAULT_PRODUCTS; }
  });
  const [bank, setBank] = useState<BankConfig>(() => {
    try { return JSON.parse(localStorage.getItem('b-bank') || '{"bankId":"mbb","accountNo":"","accountName":"","apiService":"none","apiKey":""}'); } catch { return {bankId:"mbb",accountNo:"",accountName:"",apiService:"none",apiKey:""}; }
  });
  const [tempBank, setTempBank] = useState<BankConfig>(bank);
  
  const [syncId, setSyncId] = useState(() => localStorage.getItem('b-sync') || '');
  const [tmpSync, setTmpSync] = useState(syncId);
  const [syncSt, setSyncSt] = useState<'idle' | 'syncing' | 'success' | 'error' | 'warning' | 'offline'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => localStorage.getItem('b-last-sync') || 'Chưa kết nối');
  
  const [tab, setTab] = useState<'calendar'|'shop'|'stats'|'settings'>('calendar');
  const [modals, setModals] = useState({ booking: false, detail: false, prod: false, quick: false });
  const [pending, setPending] = useState<any>(null);
  const [selB, setSelB] = useState<Booking | null>(null);
  const [period, setPeriod] = useState<'day'|'week'|'month'>('day');

  const stateRef = useRef({ bookings, products, bank });
  const lockSync = useRef(false);
  const lastTimestamp = useRef(Number(localStorage.getItem('b-ts') || '0'));
  const errorHistory = useRef<string[]>([]);

  useEffect(() => { stateRef.current = { bookings, products, bank }; }, [bookings, products, bank]);

  /**
   * Fetch v15 - Tối ưu hóa để vượt qua lỗi 404 và CORS
   */
  const ultraFetch = async (url: string, method: string, data?: any) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const options: RequestInit = {
      method,
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
      cache: 'no-cache'
    };

    if (data) {
      options.body = JSON.stringify(data);
      // Sử dụng text/plain để bỏ qua kiểm tra CORS OPTIONS của một số WiFi sân cầu lông
      options.headers = { 'Content-Type': 'text/plain' };
    }

    try {
      const response = await fetch(url, options);
      clearTimeout(timeout);
      return response;
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  };

  const performSync = useCallback(async (targetId: string, mode: 'push' | 'pull' | 'force-pull') => {
    if (!targetId || lockSync.current) return;
    
    const cleanId = targetId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanId.length < 3) return;

    // URL cho việc lấy dữ liệu (GET) - thêm nocache để đảm bảo dữ liệu mới nhất
    const getUrl = `https://kvdb.io/${CLOUD_BUCKET}/${cleanId}?t=${Date.now()}`;
    // URL cho việc lưu dữ liệu (PUT) - KHÔNG thêm query string để tránh lỗi server
    const putUrl = `https://kvdb.io/${CLOUD_BUCKET}/${cleanId}`;

    if (mode !== 'pull') setSyncSt('syncing');

    try {
      const response = await ultraFetch(getUrl, 'GET');
      
      // XỬ LÝ LỖI 404 (Dữ liệu chưa có trên Cloud)
      if (response.status === 404) {
        if (mode === 'push' || (mode === 'pull' && stateRef.current.bookings.length > 0)) {
          setSyncMsg('Đang tạo mã mới...');
          await doPush(putUrl);
        } else {
          setSyncSt('warning');
          setSyncMsg('Chờ dữ liệu máy này...');
        }
        return;
      }

      if (response.status === 429) {
        setSyncSt('warning');
        setSyncMsg('Server bận (Thử lại sau)');
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const cloudData = await response.json();
      if (!cloudData) return;

      const cloudTs = Number(cloudData.timestamp || 0);

      // Đồng bộ dữ liệu
      if (mode === 'force-pull' || cloudTs > lastTimestamp.current) {
        lockSync.current = true;
        setBookings(cloudData.bookings || []);
        setProducts(cloudData.prods || DEFAULT_PRODUCTS);
        setBank(cloudData.bank || bank);
        lastTimestamp.current = cloudTs;
        localStorage.setItem('b-ts', cloudTs.toString());
        setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
        setSyncSt('success');
        setSyncMsg('Đã tải từ Cloud');
        setTimeout(() => { lockSync.current = false; }, 1000);
      } else if (lastTimestamp.current > cloudTs && mode === 'pull') {
        // Máy này có dữ liệu mới hơn -> tự động cập nhật lên Cloud
        await doPush(putUrl);
      } else {
        setSyncSt('success');
        setSyncMsg('Dữ liệu đã khớp');
      }

      if (mode === 'push') await doPush(putUrl);
      
    } catch (err: any) {
      console.error("Sync Error:", err);
      errorHistory.current = [err.message || "Lỗi mạng", ...errorHistory.current].slice(0, 3);
      
      if (!navigator.onLine) {
        setSyncSt('offline');
        setSyncMsg('Mất Internet');
      } else {
        setSyncSt('error');
        setSyncMsg('Lỗi kết nối');
      }
    }
  }, [bank]);

  const doPush = async (url: string) => {
    const newTs = Date.now();
    const payload = { 
      bookings: stateRef.current.bookings, 
      prods: stateRef.current.products, 
      bank: stateRef.current.bank, 
      timestamp: newTs,
      ver: '15.0'
    };
    
    const res = await ultraFetch(url, 'PUT', payload);

    if (res.ok) {
      lastTimestamp.current = newTs;
      localStorage.setItem('b-ts', newTs.toString());
      setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
      setSyncSt('success');
      setSyncMsg('Đã lưu Cloud');
    } else {
      throw new Error(`Ghi dữ liệu thất bại: ${res.status}`);
    }
  };

  useEffect(() => {
    if (!syncId) return;
    let timer: any;
    const loop = async () => {
      await performSync(syncId, 'pull');
      timer = setTimeout(loop, 30000); // 30s đồng bộ 1 lần để bền bỉ hơn
    };
    timer = setTimeout(loop, 2000);
    return () => clearTimeout(timer);
  }, [syncId, performSync]);

  useEffect(() => {
    localStorage.setItem('b-bookings', JSON.stringify(bookings));
    localStorage.setItem('b-prods', JSON.stringify(products));
    localStorage.setItem('b-bank', JSON.stringify(bank));
    localStorage.setItem('b-sync', syncId);
    localStorage.setItem('b-last-sync', lastSyncTime);
  }, [bookings, products, bank, syncId, lastSyncTime]);

  const stats = useMemo(() => {
    const now = new Date();
    let start: Date;
    if (period === 'day') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === 'week') start = getStartOfWeek(now);
    else start = getStartOfMonth(now);
    start.setHours(0, 0, 0, 0);
    const filtered = bookings.filter(b => b.status === 'paid' && new Date(b.date.split('-').join('/')).getTime() >= start.getTime());
    const rev = filtered.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
    const cost = filtered.reduce((acc, b) => acc + (b.serviceItems || []).reduce((sa, si) => sa + (si.costPrice * si.quantity), 0), 0);
    return { rev, prof: rev - cost };
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
    if (syncId) setTimeout(() => performSync(syncId, 'push'), 1000);
  }, [selectedDate, pending, syncId, performSync]);

  const handleCheckout = (b: Booking, finalValue: number) => {
    setBookings(prev => prev.map(x => {
      if (x.id === b.id || (b.groupId && x.groupId === b.groupId)) {
        const sTot = (x.serviceItems || []).reduce((a, s) => a + (s.price * s.quantity), 0);
        const cTot = x.isLive ? finalValue * 1000 : finalValue * 30000;
        return { 
          ...x, status: 'paid' as const, 
          durationSlots: x.isLive ? Math.ceil(finalValue / 30) : finalValue,
          totalAmount: cTot + sTot, remainingAmount: 0
        };
      }
      return x;
    }));
    setModals(m => ({ ...m, detail: false }));
    if (syncId) setTimeout(() => performSync(syncId, 'push'), 1000);
  };

  return (
    <div className="min-h-screen pb-28 bg-slate-50 font-inter text-slate-900 overflow-x-hidden">
      <header className="bg-white border-b sticky top-0 z-40 p-4 safe-pt shadow-sm">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 p-2.5 rounded-2xl text-white shadow-lg"><Trophy className="w-5 h-5" /></div>
            <div>
              <h1 className="font-black text-lg uppercase tracking-tighter leading-none">Badminton Pro</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <div className={cn("w-2 h-2 rounded-full", 
                    syncSt === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                    syncSt === 'syncing' ? 'bg-blue-500 animate-pulse' : 
                    syncSt === 'warning' ? 'bg-amber-500 animate-bounce' : 
                    syncSt === 'offline' ? 'bg-slate-400' : 'bg-rose-500')}></div>
                <p className={cn("text-[9px] font-black uppercase tracking-widest truncate max-w-[150px]", 
                    syncSt === 'error' ? 'text-rose-600 font-bold' : 'text-slate-500')}>
                    {syncId ? `${syncId}: ${syncMsg}` : 'CHƯA CÀI MÃ'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => syncId && performSync(syncId, 'pull')} className="bg-white p-3 rounded-xl active:scale-90 border border-slate-200 shadow-sm transition-all group">
               <RefreshCcw className={cn("w-4 h-4 text-slate-500 group-active:rotate-180 transition-transform", syncSt === 'syncing' && "animate-spin")} />
            </button>
            <button onClick={() => setModals(m => ({ ...m, quick: true }))} className="bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-700/20 uppercase tracking-widest transition-all">
              <Play className="w-3 h-3 fill-white" /> CHƠI NGAY
            </button>
          </div>
        </div>
      </header>

      <main className="p-3 max-w-7xl mx-auto space-y-4">
        {tab === 'calendar' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-5 rounded-[2.2rem] flex items-center justify-between border shadow-sm">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }} className="p-3 bg-slate-50 rounded-xl active:scale-90 transition-all border border-slate-100"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
              <div className="text-center">
                <p className="text-[10px] font-black text-emerald-700 uppercase mb-1 tracking-widest">LỊCH THI ĐẤU</p>
                <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">{selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              </div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }} className="p-3 bg-slate-50 rounded-xl active:scale-90 transition-all border border-slate-100"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-12">
              {COURTS.map(c => <Court key={c.id} court={c} bookings={bookings.filter(b => b.courtId === c.id && b.date === formatDateKey(selectedDate) && b.status === 'active')} timeSlots={TIME_SLOTS} onSlotClick={(ct, s) => { setPending({ courtId: ct, slot: s }); setModals(m => ({ ...m, booking: true })); }} onViewDetail={b => { setSelB(b); setModals(m => ({ ...m, detail: true })); }} />)}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-6 max-w-2xl mx-auto pb-12 px-1 animate-in slide-in-from-bottom-4">
            <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl overflow-hidden relative border-b-[8px] border-slate-950">
               <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12"><Globe className="w-32 h-32" /></div>
               
               <div className="flex items-center justify-between relative z-10 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/20"><Radio className="w-7 h-7 text-emerald-400 animate-pulse" /></div>
                    <h4 className="font-black uppercase text-lg tracking-tighter">Đồng bộ Cloud v15</h4>
                  </div>
                  <div className="text-[10px] font-black uppercase text-emerald-400/70">
                      Cập nhật: {lastSyncTime}
                  </div>
               </div>

               <div className="space-y-6 relative z-10">
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black text-white/30 uppercase ml-2 tracking-[0.2em]">Mã kết nối (Vd: san_xyz)</label>
                    <div className="flex gap-3">
                        <input 
                        value={tmpSync} 
                        onChange={e => setTmpSync(e.target.value)} 
                        className="flex-1 bg-white/10 border-2 border-white/10 px-6 py-5 rounded-2xl font-black text-white outline-none focus:border-emerald-500 transition-all uppercase placeholder:text-white/5" 
                        placeholder="NHẬP MÃ SÂN..." 
                        />
                        <button onClick={() => {
                            const cleanId = tmpSync.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (cleanId.length < 3) return alert("Mã cần ít nhất 3 ký tự!");
                            setSyncId(cleanId);
                            localStorage.setItem('b-sync', cleanId);
                            performSync(cleanId, 'force-pull');
                        }} className="bg-emerald-600 px-8 rounded-2xl active:scale-95 shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all flex items-center justify-center border border-white/10 text-white font-black uppercase">
                        <Save className="w-5 h-5" />
                        </button>
                    </div>
                  </div>
                  
                  {errorHistory.current.length > 0 && (
                      <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Terminal className="w-3 h-3" /> Chẩn đoán lỗi:
                          </p>
                          {errorHistory.current.map((err, i) => (
                              <p key={i} className="text-[10px] text-rose-300/70 font-mono truncate">{`> ${err}`}</p>
                          ))}
                      </div>
                  )}

                  <div className="bg-blue-500/10 p-6 rounded-[2rem] border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert className="w-5 h-5 text-blue-400" />
                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Nếu vẫn báo "Lỗi kết nối":</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-[10px] text-white/80 font-bold uppercase leading-relaxed">
                      <p className="flex items-start gap-3"><span className="bg-blue-600 w-5 h-5 flex items-center justify-center rounded-lg text-[9px] shrink-0 mt-0.5">1</span> <b>Đổi sang 4G:</b> Đa số các sân WiFi chặn cổng Cloud. Bạn chỉ cần bật <b>4G</b> trong 5 giây để app đồng bộ lần đầu.</p>
                      <p className="flex items-start gap-3"><span className="bg-blue-600 w-5 h-5 flex items-center justify-center rounded-lg text-[9px] shrink-0 mt-0.5">2</span> <b>Nhấn "Đẩy lên Cloud":</b> Nếu là máy chủ có dữ liệu đúng, hãy ép app lưu lên mạng bằng nút dưới đây.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { if(confirm("Lưu dữ liệu máy này lên Cloud?")) performSync(syncId, 'push'); }} className="flex flex-col items-center justify-center gap-3 bg-white/5 border-2 border-white/5 py-8 rounded-[2.5rem] font-black text-[10px] uppercase hover:bg-emerald-600 transition-all active:scale-95 shadow-sm text-white/70 hover:text-white">
                       <UploadCloud className="w-8 h-8 mb-1 text-emerald-500" /> Đẩy lên Cloud
                    </button>
                    <button onClick={() => { if(confirm("Xóa máy này, tải từ Cloud về?")) performSync(syncId, 'force-pull'); }} className="flex flex-col items-center justify-center gap-3 bg-white/5 border-2 border-white/5 py-8 rounded-[2.5rem] font-black text-[10px] uppercase hover:bg-blue-600 transition-all active:scale-95 shadow-sm text-white/70 hover:text-white">
                       <DownloadCloud className="w-8 h-8 mb-1 text-blue-500" /> Tải từ Cloud về
                    </button>
                  </div>
               </div>
            </div>

            <div className="bg-white p-7 rounded-[3rem] border shadow-lg space-y-6">
              <h4 className="font-black uppercase text-base ml-1 text-slate-900 tracking-tight flex items-center gap-3"><Landmark className="w-6 h-6 text-emerald-600" /> Ngân hàng VietQR</h4>
              <div className="space-y-4">
                <select value={tempBank.bankId} onChange={e => setTempBank({...tempBank, bankId: e.target.value})} className="w-full bg-slate-50 border-2 p-5 rounded-2xl font-black text-xs outline-none focus:border-emerald-500">
                  {SUPPORTED_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="text" value={tempBank.accountNo} onChange={e => setTempBank({...tempBank, accountNo: e.target.value})} className="w-full bg-slate-50 border-2 p-5 rounded-2xl font-black text-xs" placeholder="SỐ TÀI KHOẢN..." />
                <input type="text" value={tempBank.accountName} onChange={e => setTempBank({...tempBank, accountName: e.target.value})} className="w-full bg-slate-50 border-2 p-5 rounded-2xl font-black text-xs" placeholder="TÊN TÀI KHOẢN (KHÔNG DẤU)..." />
                <button onClick={() => { setBank(tempBank); if(syncId) performSync(syncId, 'push'); alert("Đã lưu!"); }} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase text-xs active:scale-95 shadow-xl transition-all">Lưu cấu hình</button>
              </div>
            </div>
          </div>
        )}
        
        {tab === 'shop' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 px-1">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black uppercase text-slate-950">Kho hàng</h2>
              <button onClick={() => setModals(m => ({ ...m, prod: true }))} className="bg-emerald-700 text-white p-2.5 rounded-xl shadow active:scale-95"><Plus className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {products.map(p => (
                <div key={p.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-28">
                  <div className="flex justify-between items-start">
                    <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-700"><ShoppingBag className="w-3 h-3" /></div>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Xóa sản phẩm?')) { setProducts(products.filter(x => x.id !== p.id)); if(syncId) setTimeout(() => performSync(syncId, 'push'), 500); } }} className="text-slate-200 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <h3 className="font-black text-slate-800 uppercase text-[9px] leading-tight truncate">{p.name}</h3>
                    <p className="text-emerald-700 font-black text-[11px]">{formatVND(p.price).replace('₫', '')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase">Thống kê</h2>
                <div className="bg-white p-1 rounded-xl border flex gap-1">
                    {(['day', 'week', 'month'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={cn("px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all", period === p ? "bg-emerald-700 text-white shadow-md" : "text-slate-500 hover:bg-slate-50")}>
                            {p === 'day' ? 'Hôm nay' : p === 'week' ? 'Tuần' : 'Tháng'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
                <p className="text-[10px] font-black text-emerald-400 uppercase mb-2 tracking-[0.2em]">Lợi nhuận dự kiến</p>
                <p className="text-4xl font-black tracking-tighter tabular-nums">{formatVND(stats.prof)}</p>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-[0.2em]">Tổng doanh thu</p>
                <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{formatVND(stats.rev)}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center safe-pb rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] z-50">
        {[
          { id: 'calendar', icon: CalendarIcon, l: 'Sân chơi' }, 
          { id: 'shop', icon: ShoppingBag, l: 'Dịch vụ' }, 
          { id: 'stats', icon: BarChart3, l: 'Báo cáo' },
          { id: 'settings', icon: Settings2, l: 'Cài đặt' }
        ].map(i => (
          <button key={i.id} onClick={() => setTab(i.id as any)} className={cn("flex flex-col items-center gap-2 px-6 py-3 rounded-2xl transition-all", tab === i.id ? "text-emerald-800 bg-emerald-50 shadow-inner scale-105" : "text-slate-400")}>
            <i.icon className={cn("w-4 h-4", tab === i.id && "fill-emerald-800/10")} />
            <span className="text-[8px] font-black uppercase tracking-widest">{i.l}</span>
          </button>
        ))}
      </nav>

      <BookingModal isOpen={modals.booking} onClose={() => setModals(m => ({ ...m, booking: false }))} onConfirm={onConfirm} courts={COURTS} initialCourtId={pending?.courtId || 0} dateStr={formatDateKey(selectedDate)} timeSlot={pending?.slot || null} allTimeSlots={TIME_SLOTS} checkAvailability={() => true} />
      <BookingDetailModal isOpen={modals.detail} onClose={() => setModals(m => ({ ...m, detail: false }))} booking={selB} products={products} bankConfig={bank} onUpdateBooking={(u) => { setBookings(prev => prev.map(b => b.id === u.id ? u : b)); if(syncId) setTimeout(() => performSync(syncId, 'push'), 1000); }} onCheckout={handleCheckout} />
      <ProductModal isOpen={modals.prod} onClose={() => setModals(m => ({ ...m, prod: false }))} onConfirm={p => { setProducts(v => [...v, { ...p, id: Date.now().toString() }]); if(syncId) setTimeout(() => performSync(syncId, 'push'), 500); }} />
      
      {modals.quick && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl border-4 border-white animate-in zoom-in-95">
            <div className="bg-emerald-950 p-6 text-white flex justify-between items-center">
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
                  if(syncId) setTimeout(() => performSync(syncId, 'push'), 1000);
                }} className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2.5rem] font-black uppercase text-xs flex justify-between items-center hover:border-emerald-500 active:scale-95 shadow-sm group transition-all">
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
    </div>
  );
};
export default App;
