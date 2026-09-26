/** Etiqueta punteada: la prenda todavía no tiene molde (se distingue de los moldes reales). */
export function NoPatternBadge({ className = '' }: { className?: string }) {
  return <span className={`hz-nopat ${className}`} title="Todavía no tiene molde">SIN MOLDE</span>;
}
