'use client';

import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ children, footer, onClose, open, title, width = 560 }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="app-modal-root">
          <motion.div
            animate={{ opacity: 1 }}
            className="app-modal-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="app-modal-panel"
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            style={{ maxWidth: width }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="app-modal-header">
              <h3>{title}</h3>
              <button onClick={onClose} type="button">
                关闭
              </button>
            </div>
            <div className="app-modal-body">{children}</div>
            {footer ? <div className="app-modal-footer">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function FormField({
  children,
  label,
  required,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-form-field">
      <label>
        {required ? <span>*</span> : null}
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputCls = 'app-modal-input';
export const selectCls = 'app-modal-input app-modal-select';
