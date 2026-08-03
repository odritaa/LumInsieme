import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import CreateRoom from "./pages/CreateRoom";
import RoomDetail from "./pages/RoomDetail";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";

/** Sin sesión no hay app: todo lo que cuelga de acá vuelve al login. */
function RequireUser() {
  const { user } = useAppContext();
  return user ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<RequireUser />}>
          <Route path="/feed" element={<Feed />} />
          <Route path="/crear-sala" element={<CreateRoom />} />
          <Route path="/sala/:id" element={<RoomDetail />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/perfil/editar" element={<EditProfile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}
