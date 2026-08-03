import { Link } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { getInitials } from "../utils/avatar";
import BrandMark from "./BrandMark";

/**
 * Barra superior común a todas las vistas internas.
 * `action` es el botón secundario de la derecha: { to, label }.
 */
export default function Navbar({ action }) {
  const { user } = useAppContext();

  return (
    <nav className="navbar">
      <Link className="navbar-logo" to="/feed">
        <BrandMark />
      </Link>
      <div className="navbar-actions">
        {action && (
          <Link className="btn-secondary text-sm" to={action.to}>
            {action.label}
          </Link>
        )}
        <Link className="navbar-avatar" to="/perfil" title="Mi perfil">
          {getInitials(user?.name)}
        </Link>
      </div>
    </nav>
  );
}
