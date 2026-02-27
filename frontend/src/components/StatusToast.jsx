export default function StatusToast({ tone, message }) {
  if (!message) return null;
  return (
    <div className={`cg-toast cg-toast-${tone || "info"}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
