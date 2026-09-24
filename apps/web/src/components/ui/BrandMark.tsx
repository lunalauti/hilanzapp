/** Logo de Hilanzapp: aguja con hilo. `inverse` para fondos color óxido. Mantener en sintonía con public/logo.svg. */
export function BrandMark({ size = 36, inverse = false }: { size?: number; inverse?: boolean }) {
  const bg = inverse ? '#FFFCF7' : '#8E3B26';
  const needle = inverse ? '#8E3B26' : '#FFFCF7';
  const thread = inverse ? '#C9855F' : '#E9C7A0';
  return (
    <svg className="hz-logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill={bg} />
      <path d="M38 21C55 20 53 36 39 40C28 43 25 50 33 53.5" fill="none" stroke={thread} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M39.5 53.5h4M47.5 53.5h4" fill="none" stroke={thread} strokeWidth="2.4" strokeLinecap="round" />
      <g transform="translate(30 32) rotate(38)">
        <path d="M-3 -22a3 3 0 0 1 6 0L1 22.5Q0 25 -1 22.5Z" fill={needle} />
        <ellipse cx="0" cy="-16" rx="1.2" ry="3.4" fill={bg} />
      </g>
    </svg>
  );
}
