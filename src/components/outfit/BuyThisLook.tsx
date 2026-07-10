import { motion } from 'framer-motion';
import type { LinkedStoreItem } from '../../types';

interface BuyThisLookProps {
  items: LinkedStoreItem[];
}

const stockLabels: Record<string, { text: string; color: string }> = {
  '1': { text: '库存充足', color: 'bg-emerald-100 text-emerald-700' },
  '2': { text: '仅剩少量', color: 'bg-amber-100 text-amber-700' },
  '3': { text: '已售罄', color: 'bg-red-100 text-red-700' },
};

export default function BuyThisLook({ items }: BuyThisLookProps) {
  if (items.length === 0) return null;

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  // Simulate varied stock status
  const getStockStatus = (idx: number) => {
    if (idx % 3 === 2) return '3';
    if (idx % 3 === 1) return '2';
    return '1';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">🛍️ 买这套</h3>
        <span className="text-xs text-gray-400">{items.length}件商品</span>
      </div>

      {/* Item list */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const stock = getStockStatus(idx);
          const stockInfo = stockLabels[stock];

          return (
            <motion.div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    👗
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {item.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{item.brand}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-pink-500">
                    ¥{item.price.toLocaleString()}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stockInfo.color}`}
                  >
                    {stockInfo.text}
                  </span>
                </div>
              </div>

              {/* Buy button */}
              <motion.a
                href={`#store-${item.storeId}`}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-400 text-white text-xs font-semibold shadow-md"
                whileTap={{ scale: 0.93 }}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  // Navigate or open store page
                }}
              >
                去购买
              </motion.a>
            </motion.div>
          );
        })}
      </div>

      {/* Total */}
      <motion.div
        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-pink-50 to-orange-50 border border-pink-100"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div>
          <p className="text-xs text-gray-500">套装总价</p>
          <p className="text-lg font-bold text-pink-600">
            ¥{totalPrice.toLocaleString()}
          </p>
        </div>
        <motion.button
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white text-sm font-bold shadow-lg shadow-pink-500/20"
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
        >
          一键购买全套
        </motion.button>
      </motion.div>

      {/* Store info */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>📍</span>
          <span>{items[0].storeName}</span>
          {items.some((it) => it.storeName !== items[0].storeName) && (
            <span className="text-gray-300">等门店</span>
          )}
        </div>
      )}
    </div>
  );
}
