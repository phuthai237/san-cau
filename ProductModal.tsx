
import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Tag, Wallet, Plus, CheckCircle } from 'lucide-react';
import { Product } from './types';
import { cn } from './utils';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Omit<Product, 'id'>) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPrice('');
      setCostPrice('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '' || costPrice === '') return;
    onConfirm({
      name,
      price: Number(price),
      costPrice: Number(costPrice)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-emerald-700 p-6 md:p-8 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Plus className="w-8 h-8" />
            <h3 className="text-xl font-black uppercase tracking-tight">Thêm sản phẩm mới</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-white/20"><X className="w-6 h-6" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 bg-gray-50">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Tên sản phẩm</label>
              <div className="relative">
                <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input 
                  autoFocus
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ví dụ: Nước suối..."
                  className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-600 uppercase ml-2 tracking-widest">Giá bán (VND)</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-200" />
                  <input 
                    type="number" required value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-rose-500 uppercase ml-2 tracking-widest">Giá vốn (VND)</label>
                <div className="relative">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-200" />
                  <input 
                    type="number" required value={costPrice} onChange={e => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-white border border-gray-200 text-gray-500 font-black rounded-2xl uppercase active:scale-95 transition-all">Hủy</button>
            <button type="submit" className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" /> Lưu sản phẩm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
