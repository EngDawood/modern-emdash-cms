import { useEffect, type RefObject } from 'react';
import Icon from './icons';
import { STATUS, PRIORITY, PAYMENT, currency, type Lang } from './data';

interface PillProps {
  kind: 'status' | 'priority' | 'payment';
  value: string;
  lang: Lang;
}

export function Pill({ kind, value, lang }: PillProps) {
  const maps = { status: STATUS, priority: PRIORITY, payment: PAYMENT };
  const v = maps[kind][value];
  if (!v) return null;
  return (
    <span className={`pill pill--${v.cls}`}>
      <span className="dot" />
      {lang === 'ar' ? v.ar : v.en}
    </span>
  );
}

interface IconBtnProps {
  icon: string;
  onClick?: () => void;
  title?: string;
  size?: number;
}

export function IconBtn({ icon, onClick, title, size = 14 }: IconBtnProps) {
  return (
    <button className="btn btn--ghost btn--icon" title={title} onClick={onClick} aria-label={title}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function SAR({ amount }: { amount: number }) {
  return <span>﷼{' '}{currency(amount)}</span>;
}

export function useClickOutside(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onClose]);
}
