export default function Spinner({ label = 'Laden…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__cell" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
