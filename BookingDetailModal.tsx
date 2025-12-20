import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Plus, Minus, Trash2, CheckCircle, Info, Timer, Loader2, AlertTriangle, QrCode, Landmark, Search, Copy, RefreshCw } from 'lucide-react';
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
    if (booking.isLive && booking.actualStartTime) return Math.max(1, Math.ceil(((now.getTime() - new Date(booking.actualStartTime).getTime()) / 3600000) * 2)) * 30000;
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
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0">
      <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
        <div className="bg-emerald-900 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">{booking.isLive ? <Timer className="animate-pulse text-emerald-400" /> : <Info />}<div><h3 className="font-black uppercase">{booking.isLive ? 'Tính giờ' : 'Chi tiết'}</h3><p className="text-[10px] opacity-50 uppercase">{booking.courtId === 0 ? 'Khách lẻ' : `Sân ${booking.courtId}`}</p></div></div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-xl"><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-6 pb-40 md:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border flex justify-between uppercase text-[10px] font-black"><div><p className="text-gray-400 mb-1">Khách</p><p className="text-xs">{booking.customerName}</p></div><div className="text-right"><p className="text-gray-400 mb-1">SĐT</p><p className="text-xs">{booking.phoneNumber}</p></div></div>
              {booking.isLive ? <div className="bg-blue-600 p-8 rounded-[2rem] text-white text-center shadow-lg"><p className="text-[10px] font-black uppercase mb-2 opacity-70">Thời gian</p><div className="text-5xl font-black">{Math.floor(cTot/60000).toString().padStart(2,'0')}:{Math.floor((cTot%60000)/1000).toString().padStart(2,'0')}</div></div> : !booking.courtId && <div className="bg-white p-6 rounded-[2rem] border flex items-center justify-between"><button onClick={() => setSlots(s => Math.max(1, s - 1))} className="w-12 h-12 bg-gray-100 rounded-xl"><Minus className="mx-auto"/></button><div className="text-center"><p className="text-3xl font-black">{slots/2}h</p></div><button onClick={() => setSlots(s => s + 1)} className="w-12 h-12 bg-emerald-600 text-white rounded-xl"><Plus className="mx-auto"/></button></div>}
            </div>
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl border min-h-[150px] flex flex-col">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-3">Dịch vụ</p>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">{booking.serviceItems?.map((it, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-xl text-[10px] font-bold uppercase"><span>{it.productName}</span><div className="flex gap-2 items-center"><span className="text-emerald-600">x{it.quantity}</span><button onClick={() => onUpdateBooking({...booking, serviceItems: booking.serviceItems?.filter(x => x.productId !== it.productId)})} className="text-rose-500"><Trash2 className="w-4 h-4" /></button></div></div>))}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">{products.slice(0,4).map(p => (<button key={p.id} onClick={() => { const items = [...(booking.serviceItems || [])]; const idx = items.findIndex(i => i.productId === p.id); if (idx > -1) items[idx].quantity++; else items.push({ ...p, productId: p.id, productName: p.name, quantity: 1 }); onUpdateBooking({...booking, serviceItems: items}); }} className="p-3 bg-white border rounded-2xl text-[9px] font-black uppercase">+{p.name}</button>))}</div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white border-t space-y-4 shadow-2xl">
          <div className="bg-emerald-950 p-6 rounded-[2rem] text-white flex justify-between items-center"><div><p className="text-[9px] font-black text-emerald-400 uppercase mb-1">Cần trả</p><p className="text-4xl font-black">{formatVND(pay)}</p></div><div className="text-right text-[8px] opacity-40 font-bold leading-none"><p>SÂN: {formatVND(cTot)}</p><p className="my-1">HÀNG: {formatVND(sTot)}</p>{Number(booking.deposit) > 0 && <p className="text-rose-400">CỌC: -{formatVND(booking.deposit)}</p>}</div></div>
          <div className="flex gap-3"><button onClick={() => setSt(s => ({...s, qr:true, img:'loading', v:Date.now()}))} className="flex-1 py-5 bg-emerald-50 text-emerald-700 rounded-[1.5rem] font-black uppercase text-xs flex items-center justify-center gap-2"><QrCode className="w-5 h-5" /> Mã QR</button>
            <button disabled={st.proc} onClick={() => { if(!st.conf) { setSt(s=>({...s, conf:true})); setTimeout(()=>setSt(s=>({...s, conf:false})), 3000); } else { setSt(s=>({...s, proc:true})); onCheckout(booking, slots); } }} className={cn("flex-[2] py-5 text-white rounded-[1.5rem] font-black uppercase transition-all", st.conf ? "bg-amber-500" : "bg-emerald-600")}>{st.conf ? "Bấm lại để chốt" : "Tiền mặt"}</button>
          </div>
        </div>
        {st.qr && (
          <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden">
              <div className={cn("p-6 text-center text-white relative", st.found ? "bg-emerald-500" : "bg-emerald-700")}><button onClick={() => setSt(s=>({...s, qr:false}))} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full"><X className="w-4 h-4" /></button><Landmark className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-2xl font-black">{formatVND(pay)}</p><p className="text-[10px] font-bold opacity-60 uppercase">{bankConfig.accountName}</p></div>
              <div className="p-8 space-y-6 text-center">
                <div className="bg-gray-50 aspect-square rounded-3xl border-2 border-dashed border-gray-200 flex items-center justify-center relative min-h-[250px]">
                  {st.found ? <div className="text-emerald-500"><CheckCircle className="w-16 h-16 mx-auto mb-2" /><p className="font-black uppercase">Đã nhận tiền</p></div> : (
                    <>
                      {st.img === 'loading' && <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />}
                      {st.img === 'error' && <div className="p-4"><AlertTriangle className="text-rose-500 mx-auto mb-2" /><p className="text-xs font-bold">Lỗi tải QR</p><button onClick={() => setSt(s=>({...s, v:Date.now()}))} className="mt-2 text-emerald-600"><RefreshCw className="w-4 h-4 mx-auto" /></button></div>}
                      <img src={qrUrl} className={cn("w-full p-4", st.img === 'loaded' ? 'block' : 'hidden')} onLoad={() => setSt(s=>({...s, img:'loaded'}))} onError={() => setSt(s=>({...s, img:'error'}))} />
                    </>
                  )}
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl flex justify-between items-center text-left"><div><p className="text-[9px] font-black text-emerald-400 uppercase">Nội dung</p><p className="font-black">{memo}</p></div><button onClick={() => { navigator.clipboard.writeText(memo); alert("OK!"); }} className="p-2 bg-emerald-600 text-white rounded-lg"><Copy className="w-4 h-4" /></button></div>
                <button onClick={() => setSt(s=>({...s, qr:false}))} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs">Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};