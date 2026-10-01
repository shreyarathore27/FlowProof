import { useEffect, useState, useRef } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover' | 'always';
  trigger?: boolean;
}

export function DecryptedText({
  text,
  speed = 45,
  maxIterations = 14,
  characters = '0123456789abcdefABCDEF!@#$%&*<>[]{}',
  className = '',
  encryptedClassName = 'text-primary/70 opacity-80',
  trigger = true,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isScrambling, setIsScrambling] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    setIsScrambling(true);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setDisplayText(() =>
        text
          .split('')
          .map((char, index) => {
            if (char === ' ' || char === '\n' || char === '-') return char;
            if (index < iteration) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        setIsScrambling(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }

      iteration += 1 / (maxIterations / text.length || 1);
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, trigger, speed, maxIterations, characters]);

  return (
    <span className={`font-mono transition-colors duration-150 ${isScrambling ? encryptedClassName : ''} ${className}`}>
      {displayText}
    </span>
  );
}
