export function Placeholder({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <div className="d-flex flex-column gap-2">
      <span className="hz-eyebrow">{eyebrow}</span>
      <h1 className="hz-page-title">{title}</h1>
      <p className="text-secondary mt-2 mb-0">{note}</p>
    </div>
  );
}
