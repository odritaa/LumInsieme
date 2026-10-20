export default function SessionLoader({ message = "Verificando tu sesión…" }) {
  return (
    <div className="page login-container">
      <p className="empty-state">{message}</p>
    </div>
  );
}
