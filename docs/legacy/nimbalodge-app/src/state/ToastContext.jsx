import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  const toast = useCallback((msg) => {
    setMessage(msg);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={"toast" + (show ? " show" : "")} role="status" aria-live="polite">
        {message}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
