import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Plus, Minus, Trash2, CheckCircle, Info, Timer, Loader2, AlertTriangle, QrCode, Landmark, Search, Copy, RefreshCw, ShoppingBag, Package, PlusCircle, Zap, Star } from 'lucide-react';
import { Booking, Product, BankConfig } from './types';
import { formatVND, cn } from './utils';

const BINS: any = { vcb:'970436', mbb:'970422', tcb:'970407', bidv:'970418', ctg:'970415', acb:'970416', tpb:'970423', vpb:'970432', agribank:'970405' };
const clean = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase();

export const BookingDetailModal: React.FC<{isOpen:boolean, onClose:()=>void, booking:Booking|null, products:Product[], bankConfig:BankConfig, onUpdateBooking:(u:Booking)=>void, onCheckout:(b:Booking, d:number)=>void}> = 
({ isOpen, onClose, booking, products, bankConfig, onUpdateBooking, onCheckout }) => {
  const [slots, setSlots] = useState(0);
  const [now, setNow] = useState(new Date());
  const [st, setSt] = useState({ conf:false, proc:false, qr:false, found:false, img:'loading', v:0 });
  const poll = useRef<any>(null);

  useEffect(() => { if (booking && isOpen) { setSlots(booking.durationSlots); setSt(s => ({ ...s, conf:false, proc:false, qr:false, found:false, img:'loading' })); } }, [booking?.id, isOpen]);
  useEffect(() => { let t = setInterval(() => setNow(new Date()), 3000); return () => clearInterval(t); }, []);

  const memo = useMemo(() => booking ? `BDP${booking.id.slice(-6).toUpperCase()}` : "", [booking]);
  const sTot = useMemo(() => (booking?.serviceItems || []).reduce((a, b) => a + (b.price * b.quantity), 0), [booking]);
  const cTot = useMemo(() => {
    if (!booking) return 0;
    if (booking.isLive && booking.actualStartTime) {
      const diffMs = now.getTime() - new Date(booking.actualStartTime).getTime();
      return Math.max(1, Math.ceil((diffMs / 3600000) * 2)) * 30000;
    }
    return booking.courtId === 0 ? 0 : slots * 30000;
  }, [booking, slots, now]);

  const pay = Math.max(0, (cTot + sTot) - (Number(booking?.deposit) || 0));
  const qrUrl = useMemo(() => {
    if (!st.qr || !bankConfig.accountNo) return "";
    const b = BINS[bankConfig.bankId] || bankConfig.bankId;
    const a = bankConfig.accountNo.replace(/\s+/g, '');
    const n = encodeURIComponent(clean(bankConfig.accountName));
    return `https://img.vietqr.io/image/${b}-${a}-compact2.png?amount=${Math.round(pay)}&addInfo=${memo}&accountName=${n}&v=${st.v}`;
  }, [st.qr, st.v, bankConfig, pay, memo]);

  const check = useCallback(async () => {
    if (!bankConfig.apiKey || st.found || !st.qr) return;
    try {
      const isC = bankConfig.apiService === 'casso';
      const r = await fetch(isC ? 'https://api.casso.vn/v2/transactions?pageSize=10' : `https://my.sepay.vn/api/transactions/list?account_number=${bankConfig.accountNo.replace(/\s+/g,'')}&limit=10`, 
      { headers: { 'Authorization': (isC ? 'Apikey ' : 'Bearer ') + bankConfig.apiKey } });
      if (r.ok) {
        const d = await r.json();
        const txs = isC ? d.data?.records : d.items;
        if (txs?.some((t: any) => (t.description || t.content || "").toUpperCase().includes(memo) && Number(t.amount) >= Math.round(pay))) {
          setSt(s => ({...s, found:true})); setTimeout(() => onCheckout(booking!, slots), 1500);
        }
      }
    } catch (e) {}
  }, [bankConfig, memo, pay, st.found, st.qr, booking, slots, onCheckout]);

  useEffect(() => { if (st.qr && bankConfig.apiKey && !st.found) poll.current = setInterval(check, 8000); return () => clearInterval(poll.current); }, [st.qr, st.found, check]);

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-slate-950/90 backdrop-blur-md p-0">
      <div className="bg-white rounded-t-[3.5rem] md:rounded-[3.5rem] w-full max-w-6xl h-[96vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="bg-emerald-950 p-6 md:p-8 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-5">
            {booking.isLive ? <div className="bg-blue-500/20 p-4 rounded-3xl"><Timer className="animate-pulse text-blue-400 w-8 h-8 md:w-10 md:h-10" /></div> : <div className="bg-emerald-500/20 p-4 rounded-3xl"><Package className="w-8 h-8 md:w-10 md:h-10 text-emerald-400" /></div>}
            <div>
              <h3 className="font-black text-2xl md:text-3xl uppercase tracking-tighter leading-none">{booking.isLive ? 'Tính giờ thực tế' : 'Đơn đặt sân'}</h3>
              <p className="text-[10px] md:text-[12px] font-black opacity-40 uppercase tracking-[0.4em] mt-1">{booking.courtId === 0 ? 'Khách lẻ' : `Sân số ${booking.courtId}`}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 active:scale-90 transition-all shadow-lg"><X className="w-8 h-8 md:w-10 md:h-10"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 flex flex-col gap-6 custom-scrollbar pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Khách hàng</p>
                    <p className="text-2xl font-black text-slate-950 leading-none">{booking.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SĐT</p>
                    <p className="text-lg font-black text-slate-700">{booking.phoneNumber}</p>
                  </div>
                </div>
              </div>

              {booking.isLive ? (
                <div className="bg-blue-700 p-8 rounded-[2.5rem] text-white text-center shadow-2xl relative overflow-hidden">
                  <Timer className="absolute right-[-10%] top-[-10%] w-40 h-40 opacity-10 rotate-12" />
                  <p className="text-[10px] font-black uppercase mb-2 opacity-60 tracking-[0.4em]">Tổng thời gian chơi</p>
                  <div className="text-5xl font-black tabular-nums tracking-tighter mb-4 drop-shadow-xl">
                    {Math.floor(cTot/30000*30)} Phút
                  </div>
                  <div className="bg-white/20 px-6 py-2 rounded-xl font-black text-sm inline-block uppercase tracking-widest">Tiền sân: {formatVND(cTot)}</div>
                </div>
              ) : booking.courtId > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-200 shadow-sm flex items-center justify-between">
                  <button onClick={() => setSlots(s => Math.max(1, s - 1))} className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center active:scale-90 transition-all hover:bg-slate-200 border-2 border-slate-200 shadow-sm"><Minus className="w-8 h-8 text-slate-900"/></button>
                  <div className="text-center"><p className="text-5xl font-black text-slate-950 tracking-tighter">{slots/2} Giờ</p><p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mt-1">Dự kiến</p></div>
                  <button onClick={() => setSlots(s => s + 1)} className="w-16 h-16 bg-emerald-700 text-white rounded-2xl flex items-center justify-center active:scale-90 transition-all hover:bg-emerald-800 shadow-xl"><Plus className="w-8 h-8"/></button>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 flex flex-col gap-6">
               <div className="bg-white p-6 md:p-8 rounded-[3.5rem] border-4 border-emerald-500 shadow-[0_25px_80px_rgba(16,185,129,0.25)] flex-1 flex flex-col min-h-[550px] relative overflow-hidden">
                <div className="flex justify-between items-center mb-8">
                    <p className="text-[18px] font-black text-emerald-950 uppercase tracking-[0.4em] flex items-center gap-4">
                        <ShoppingBag className="w-10 h-10 text-emerald-600" /> Giỏ hàng dịch vụ
                    </p>
                    <div className="bg-emerald-700 text-white px-8 py-3 rounded-full text-[16px] font-black uppercase shadow-2xl">
                        {booking.serviceItems?.length || 0} mục
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto pr-3 custom-scrollbar max-h-[220px] mb-4">
                  {(!booking.serviceItems || booking.serviceItems.length === 0) && (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                      <ShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
                      <p className="font-black uppercase tracking-[0.2em] text-xs">Chưa có dịch vụ nào</p>
                    </div>
                  )}
                  {booking.serviceItems?.map((it, i) => (
                    <div key={i} className="flex justify-between items-center bg-emerald-50/50 p-6 rounded-[2rem] border-2 border-emerald-100 shadow-sm animate-in zoom-in-95">
                      <div className="flex flex-col">
                        <span className="text-2xl font-black text-emerald-950 uppercase leading-none mb-1 tracking-tighter">{it.productName}</span>
                        <span className="text-sm font-bold text-emerald-700/60">{formatVND(it.price)}</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="flex items-center bg-white border-4 border-emerald-300 rounded-[1.5rem] overflow-hidden shadow-sm">
                            <button onClick={() => {
                                const items = [...(booking.serviceItems || [])];
                                if (it.quantity > 1) {
                                    items[i] = { ...it, quantity: it.quantity - 1 };
                                    onUpdateBooking({...booking, serviceItems: items});
                                } else {
                                    onUpdateBooking({...booking, serviceItems: items.filter(x => x.productId !== it.productId)});
                                }
                            }} className="p-4 hover:bg-emerald-50 text-slate-400 active:scale-75 transition-all"><Minus className="w-6 h-6"/></button>
                            <span className="px-6 font-black text-emerald-800 text-2xl min-w-[60px] text-center">{it.quantity}</span>
                            <button onClick={() => {
                                const items = [...(booking.serviceItems || [])];
                                items[i] = { ...it, quantity: it.quantity + 1 };
                                onUpdateBooking({...booking, serviceItems: items});
                            }} className="p-4 hover:bg-emerald-50 text-emerald-600 active:scale-75 transition-all"><Plus className="w-6 h-6"/></button>
                        </div>
                        <button onClick={() => onUpdateBooking({...booking, serviceItems: (booking.serviceItems || []).filter(x => x.productId !== it.productId)})} className="text-rose-500 p-5 hover:bg-rose-50 rounded-2xl active:scale-75 transition-all"><Trash2 className="w-7 h-7" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8 border-t-[10px] border-slate-50 bg-emerald-600/5 -mx-6 md:-mx-8 px-6 md:px-8 pb-10">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <p className="text-[20px] font-black text-emerald-800 uppercase tracking-[0.5em] flex items-center gap-4">
                            <Zap className="w-8 h-8 fill-emerald-600 animate-pulse" /> Thêm nhanh dịch vụ
                        </p>
                        <div className="flex gap-1.5">
                            <Star className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                            <Star className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                            <Star className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8">
                        {products.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => {
                                    const items = [...(booking.serviceItems || [])];
                                    const idx = items.findIndex(i => i.productId === p.id);
                                    if (idx > -1) {
                                        items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
                                    } else {
                                        items.push({ productId: p.id, productName: p.name, price: p.price, costPrice: p.costPrice, quantity: 1 });
                                    }
                                    onUpdateBooking({...booking, serviceItems: items});
                                }} 
                                className="group relative bg-white border-[6px] border-emerald-500 p-8 rounded-[3.5rem] hover:bg-emerald-700 hover:border-emerald-800 transition-all active:scale-90 shadow-[0_25px_50px_rgba(16,185,129,0.35)] hover:shadow-emerald-500/50 flex flex-col items-center text-center gap-4 overflow-hidden min-h-[180px] justify-center"
                            >
                                <PlusCircle className="absolute top-4 right-4 w-12 h-12 text-emerald-100 group-hover:text-white/20 transition-colors" />
                                <span className="font-black text-slate-950 text-3xl uppercase leading-none group-hover:text-white transition-all tracking-tighter">
                                    {p.name}
                                </span>
                                <div className="bg-emerald-950 px-8 py-3 rounded-[2rem] group-hover:bg-white transition-all shadow-2xl">
                                    <span className="text-emerald-400 font-black text-lg group-hover:text-emerald-900 transition-colors tabular-nums">
                                        {formatVND(p.price).replace('₫', '')}
                                    </span>
                                </div>
                                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                            </button>
                        ))}
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10 bg-white border-t-2 border-slate-200 space-y-6 shadow-[0_-20px_60px_rgba(0,0,0,0.15)] shrink-0 safe-pb">
          <div className="bg-emerald-950 p-6 md:p-8 rounded-[3.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.5em] mb-2">Tổng cần thanh toán</p>
              <p className="text-5xl md:text-7xl font-black tabular-nums tracking-tighter">{formatVND(pay)}</p>
            </div>
            <div className="text-right text-[12px] font-black opacity-50 space-y-1.5 uppercase tracking-widest relative z-10">
              <p>Sân: {formatVND(cTot)}</p>
              <p>Hàng: {formatVND(sTot)}</p>
              {Number(booking.deposit) > 0 && <p className="text-rose-400">Đã cọc: -{formatVND(booking.deposit)}</p>}
            </div>
          </div>
          
          <div className="flex gap-6">
            <button onClick={() => setSt(s => ({...s, qr:true, img:'loading', v:Date.now()}))} className="flex-1 py-7 bg-emerald-50 text-emerald-700 rounded-[2.5rem] font-black uppercase text-sm flex items-center justify-center gap-4 active:scale-95 transition-all shadow-md border-4 border-emerald-100 hover:bg-emerald-100">
              <QrCode className="w-8 h-8" /> QR Chuyển khoản
            </button>
            <button disabled={st.proc} onClick={() => { if(!st.conf) { setSt(s=>({...s, conf:true})); setTimeout(()=>setSt(s=>({...s, conf:false})), 3000); } else { setSt(s=>({...s, proc:true})); onCheckout(booking, slots); } }} className={cn("flex-[2] py-7 text-white rounded-[2.5rem] font-black uppercase shadow-2xl transition-all relative overflow-hidden text-lg tracking-[0.2em]", st.conf ? "bg-amber-600 ring-8 ring-amber-100" : "bg-emerald-700 hover:bg-emerald-800 ring-8 ring-emerald-50")}>
              {st.conf ? "Xác nhận chốt đơn" : "Thu tiền mặt"}
            </button>
          </div>
        </div>

        {st.qr && (
          <div className="fixed inset-0 z-[10000] bg-slate-950/98 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[4rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className={cn("p-12 text-center text-white relative", st.found ? "bg-emerald-500" : "bg-emerald-950")}>
                <button onClick={() => setSt(s=>({...s, qr:false}))} className="absolute top-10 right-10 p-4 bg-white/10 rounded-2xl active:scale-75 transition-all"><X className="w-6 h-6" /></button>
                <Landmark className="w-14 h-14 mx-auto mb-6 text-emerald-400 opacity-60" />
                <p className="text-5xl font-black tabular-nums tracking-tighter mb-2">{formatVND(pay)}</p>
                <p className="text-[11px] font-black opacity-50 uppercase tracking-[0.4em]">{bankConfig.accountName}</p>
              </div>
              <div className="p-10 space-y-10 text-center bg-white">
                <div className="bg-slate-50 aspect-square rounded-[3rem] border-4 border-dashed border-slate-200 flex items-center justify-center relative min-h-[320px] overflow-hidden shadow-inner">
                  {st.found ? (
                    <div className="text-emerald-700 flex flex-col items-center">
                      <div className="bg-emerald-100 p-8 rounded-full mb-6 animate-in zoom-in duration-500"><CheckCircle className="w-20 h-20" /></div>
                      <p className="font-black text-3xl uppercase tracking-tighter">Thanh toán xong!</p>
                    </div>
                  ) : (
                    <>
                      {st.img === 'loading' && <Loader2 className="w-16 h-16 animate-spin text-emerald-700 opacity-20" />}
                      <img src={qrUrl} className={cn("w-full p-6 transition-all duration-700", st.img === 'loaded' ? 'scale-100 opacity-100' : 'scale-90 opacity-0 absolute')} onLoad={() => setSt(s=>({...s, img:'loaded'}))} onError={() => setSt(s=>({...s, img:'error'}))} />
                    </>
                  )}
                </div>
                <div className="bg-emerald-50 p-8 rounded-[2rem] flex justify-between items-center text-left border-2 border-emerald-100 shadow-sm">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-1.5">Nội dung</p>
                    <p className="font-black text-emerald-950 text-3xl tracking-tighter leading-none">{memo}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(memo); alert("Đã copy nội dung!"); }} className="p-5 bg-emerald-700 text-white rounded-[1.5rem] shadow-xl active:scale-75 transition-all hover:bg-emerald-800"><Copy className="w-6 h-6" /></button>
                </div>
                <button onClick={() => setSt(s=>({...s, qr:false}))} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black uppercase text-sm tracking-[0.3em] active:scale-95 transition-all">Đóng mã</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
