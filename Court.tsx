
import React from 'react';
import { Court as CourtType, Booking, TimeSlot } from './types';
import { cn, formatVND } from './utils';
import { User, Clock, Lock, Check, Info, Play } from 'lucide-react';

interface CourtProps {
  court: CourtType;
  bookings: Booking[];
  timeSlots: TimeSlot[];
  onSlotClick: (courtId: number, slot: TimeSlot) => void;
  onViewDetail: (booking: Booking) => void;
}

export const Court: React.FC<CourtProps> = ({ court, bookings, timeSlots, onSlotClick, onViewDetail }) => {
  return (
    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full transition-all">
      <div className="bg-emerald-800 p-6 md:p-8 text-center relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-32 md:w-48 h-32 md:h-48 bg-white/10 rounded-full blur-3xl"></div>
        <h2 className="text-white text-2xl md:text-4xl font-black uppercase tracking-tighter relative z-10">{court.name}</h2>
        
        <div className="flex justify-center gap-4 mt-3 relative z-10">
            <div className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/20 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="text-[8px] md:text-xs text-white font-black uppercase tracking-widest">TRỐNG</span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/20 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                <span className="text-[8px] md:text-xs text-white font-black uppercase tracking-widest">ĐÃ ĐẶT</span>
            </div>
        </div>
      </div>
      
      <div className="p-4 md:p-6 flex-1 bg-gray-50/50">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {timeSlots.map((slot) => {
            const booking = bookings.find((b) => b.timeSlot === slot.time);
            const isBooked = !!booking;
            const isLive = booking?.isLive;

            return (
              <div
                key={slot.time}
                className={cn(
                  "relative group w-full p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-start justify-between min-h-[100px] md:min-h-[120px] cursor-pointer",
                  isBooked 
                    ? (isLive ? "bg-blue-50 border-blue-200 shadow-md ring-2 ring-blue-400/20" : "bg-rose-50 border-rose-100 shadow-inner") 
                    : "bg-white border-gray-100 hover:border-emerald-500 active:scale-95 shadow-sm"
                )}
                onClick={() => isBooked ? onViewDetail(booking) : onSlotClick(court.id, slot)}
              >
                <div className="flex items-center justify-between w-full mb-2">
                    <div className={cn(
                        "px-2 py-1 rounded-lg text-sm md:text-lg font-black tracking-tight flex items-center gap-1.5",
                        isBooked 
                          ? (isLive ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-700") 
                          : "bg-emerald-50 text-emerald-800"
                    )}>
                         {isLive ? <Play className="w-3.5 h-3.5 fill-blue-800 animate-pulse" /> : <Clock className="w-3.5 h-3.5" />}
                         {slot.time}
                    </div>
                    {isBooked && (
                         <div className={cn(
                            "p-2 rounded-lg shadow-sm",
                            isLive ? "bg-blue-600" : "bg-emerald-600"
                          )}>
                            <Info className="w-4 h-4 text-white" />
                         </div>
                    )}
                </div>

                <div className="w-full">
                     {isBooked ? (
                        <div className="flex flex-col">
                            <span className={cn("text-[8px] font-black uppercase leading-none mb-1", isLive ? "text-blue-500" : "text-rose-400")}>
                              {isLive ? 'ĐANG CHƠI' : 'KHÁCH HÀNG'}
                            </span>
                            <span className={cn("text-sm md:text-lg font-black truncate w-full", isLive ? "text-blue-900" : "text-rose-950")}>
                                {booking.customerName}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <span className="text-[8px] text-emerald-400 font-black uppercase leading-none mb-1 tracking-widest">TRẠNG THÁI</span>
                            <span className="text-xs md:text-base text-gray-400 font-bold uppercase">Đặt ngay</span>
                        </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="p-4 bg-white border-t border-gray-100 text-center">
         <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Cập nhật mỗi 30 phút</p>
      </div>
    </div>
  );
};
