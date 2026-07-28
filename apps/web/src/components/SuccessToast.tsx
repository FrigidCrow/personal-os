import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle, X } from "@phosphor-icons/react";

interface SuccessToastValue {
  showSuccess: (message: string) => void;
}

const SuccessToastContext = createContext<SuccessToastValue | null>(null);

export function SuccessToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setMessage(null);
  }, []);

  const showSuccess = useCallback((nextMessage: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setMessage(nextMessage);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setMessage(null);
    }, 3200);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return (
    <SuccessToastContext.Provider value={{ showSuccess }}>
      {children}
      <div className="success-toast-viewport" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {message ? (
            <motion.div
              className="success-toast"
              role="status"
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <CheckCircle size={20} weight="fill" aria-hidden="true" />
              <span>{message}</span>
              <button type="button" onClick={dismiss} aria-label="关闭成功提示"><X size={15} weight="bold" /></button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </SuccessToastContext.Provider>
  );
}

export function useSuccessToast(): SuccessToastValue {
  const context = useContext(SuccessToastContext);
  if (!context) throw new Error("useSuccessToast must be used within SuccessToastProvider");
  return context;
}
