import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { getStoreItems, getStoreList, purchaseItems } from '@/services/storeService';
import type { StoreItem } from '@/types';
import BottomNav from '@/components/common/BottomNav';

type CategoryFilter = 'all' | 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';

const categoryLabels: Record<CategoryFilter, string> = {
  all: '全部', top: '上装', bottom: '下装', dress: '连衣裙',
  outerwear: '外套', shoes: '鞋履', accessory: '配饰',
};

export default function StorePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [cartItems, setCartItems] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const stores = getStoreList();

  const loadItems = useCallback(async () => {
    setLoading(true);
    const data = await getStoreItems(
      selectedStore === 'all' ? undefined : selectedStore,
      selectedCategory === 'all' ? undefined : selectedCategory
    );
    setItems(data);
    setLoading(false);
  }, [selectedStore, selectedCategory]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const toggleCart = (itemId: string) => {
    setCartItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handlePurchase = async () => {
    if (cartItems.length === 0) return;
    const result = await purchaseItems(
      cartItems.map((id) => ({ skuId: id, quantity: 1 })),
      selectedStore === 'all' ? 'store-hzwl' : selectedStore
    );
    setToastMsg(
      `下单成功！${result.coupon ? `🎉 获得优惠券: ${result.coupon.name}` : '订单号: ' + result.orderId.slice(-8)}`
    );
    setShowToast(true);
    setCartItems([]);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-gray-500 text-sm" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-gray-800">门店好物</h1>
          <button
            className="relative text-sm"
            onClick={() => navigate(ROUTES.PROFILE)}
          >
            🛒
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Store filter */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
          <button
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedStore === 'all' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => setSelectedStore('all')}
          >
            全部门店
          </button>
          {stores.map((store) => (
            <button
              key={store.id}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedStore === store.id ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => setSelectedStore(store.id)}
            >
              {store.name.slice(0, 4)}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {(Object.entries(categoryLabels) as [CategoryFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
              }`}
              onClick={() => setSelectedCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Product grid */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-100 animate-shimmer" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-4xl mb-4 block">🛍️</span>
            <p className="text-gray-400">该分类暂无商品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const isInCart = cartItems.includes(item.id);
              return (
                <motion.div
                  key={item.id}
                  className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative bg-gray-50" style={{ aspectRatio: '3/4' }}>
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          item.stockStatus === 'in_stock'
                            ? 'bg-green-100 text-green-700'
                            : item.stockStatus === 'low_stock'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.stockStatus === 'in_stock'
                          ? '有货'
                          : item.stockStatus === 'low_stock'
                          ? '仅剩少量'
                          : '售罄'}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <button
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                          isInCart ? 'bg-pink-500 text-white' : 'bg-white/80 text-gray-400'
                        }`}
                        onClick={() => toggleCart(item.id)}
                      >
                        {isInCart ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.brand}</p>
                    <p className="text-xs text-gray-400 truncate">{item.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-pink-500">¥{item.price}</span>
                      <span className="text-[10px] text-gray-400">{item.storeName.slice(0, 4)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase bar */}
      {cartItems.length > 0 && (
        <motion.div
          className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 z-30"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-gray-800">{cartItems.length}件商品</span>
              <span className="text-xs text-gray-400 ml-2">
                ¥
                {items
                  .filter((i) => cartItems.includes(i.id))
                  .reduce((sum, i) => sum + i.price, 0)}
              </span>
            </div>
            <motion.button
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white text-sm font-bold shadow-lg"
              whileTap={{ scale: 0.95 }}
              onClick={handlePurchase}
            >
              立即购买
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Toast */}
      {showToast && (
        <motion.div
          className="fixed top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-gray-800 text-white text-xs shadow-lg z-50 whitespace-nowrap"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {toastMsg}
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}


