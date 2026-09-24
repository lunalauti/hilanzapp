import { Modal } from 'react-bootstrap';

export function ConfirmDialog({ show, title, body, confirmLabel, busy, onConfirm, onCancel }: {
  show: boolean; title: string; body: React.ReactNode; confirmLabel: string; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">{title}</Modal.Title></Modal.Header>
      <Modal.Body>{body}</Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Eliminando…' : confirmLabel}</button>
      </Modal.Footer>
    </Modal>
  );
}
