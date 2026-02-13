import { useEffect, useRef } from 'react';
import { useSpring, useTransform, type SpringOptions } from 'framer-motion';

const spring: SpringOptions = { stiffness: 100, damping: 30, duration: 0.6 };

export function AnimatedNumber({
  value,
  format = (n: number) => n.toLocaleString(),
  style,
}: {
  value: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}) {
  const motionValue = useSpring(0, spring);
  const display = useTransform(motionValue, (v) => format(Math.round(v)));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsubscribe;
  }, [display]);

  return (
    <span ref={ref} style={style}>
      {format(value)}
    </span>
  );
}
