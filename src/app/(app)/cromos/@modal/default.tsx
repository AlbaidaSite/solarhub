// Slot @modal vacío: se renderiza cuando ningún intercepting route encaja
// (estado normal en /cromos, /cromos/registrar, hard nav a /cromos/[idSlug], etc).
export default function ModalDefault() {
  return null;
}
