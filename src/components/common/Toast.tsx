import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../../stores/useNotificationStore';

const typeConfig: Record<string, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-emerald-50',
    icon: 'M9 12l2 2 4-4',
    border: 'border-emerald-200',
  },
  error: {
    bg: 'bg-red-50',
    icon: 'M18 6L6 18M6 6l12 12',
    border: 'border-red-200',
  },
  info: {
    bg: 'bg-blue-50',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    border: 'border-blue-200',
  },
};

export default function Toast() {
  const notifications = useNotificationStore((s) => s.notifications);
  const removeNotification = useNotificationStore((s) => s.removeNotification);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => {
          const cfg = typeConfig[n.type];
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 350 }}
              onClick={() => removeNotification(n.id)}
              className={`
                pointer-events-auto flex items-center gap-2.5 px-4 py-2.5
                rounded-full shadow-lg border ${cfg.bg} ${cfg.border}
                text-sm font-medium text-gray-800 cursor-pointer
                max-w-[90vw] whitespace-nowrap backdrop-blur-md
              `}
            >
              {/* Icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <path d={cfg.icon} />
              </svg>
              <span>{n.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
