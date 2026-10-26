import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import {
  deleteCurrentUser,
  fetchCurrentUser,
  logoutRequest,
  updateCurrentUser,
} from "../services/authService";
import { createSala, fetchSala, fetchSalas, joinSala, leaveSala } from "../services/salaService";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [rooms, setRooms] = useState([]);
  const [roomsStatus, setRoomsStatus] = useState("idle");
  const [roomsError, setRoomsError] = useState(null);

  /* ---- Sesión (JWT en cookie httpOnly emitida por el login-controller) ---- */

  // Rehidrata la sesión al montar: sin esto la cookie existe pero la app no sabe quién sos.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (cancelled) return;
        setUser(current);
        setAuthStatus(current ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const endSession = useCallback(() => {
    setUser(null);
    setAuthStatus("anonymous");
    setRooms([]);
    setRoomsStatus("idle");
  }, []);

  // Un 401 de cualquier servicio significa que el JWT venció: se vuelve al login.
  const guard = useCallback(
    async (request) => {
      try {
        return await request();
      } catch (error) {
        if (error.status === 401) endSession();
        throw error;
      }
    },
    [endSession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      endSession();
    }
  }, [endSession]);

  /* ---- Salas (reunion-controller) ---- */

  const upsertRoom = useCallback((room) => {
    setRooms((prev) => {
      const index = prev.findIndex((r) => r.id === room.id);
      if (index === -1) return [room, ...prev];
      const next = [...prev];
      next[index] = room;
      return next;
    });
  }, []);

  const removeRoom = useCallback((id) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const loadRooms = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setRoomsStatus("loading");
        setRoomsError(null);
      }
      try {
        setRooms(await guard(fetchSalas));
        setRoomsStatus("ready");
      } catch (error) {
        // En refrescos silenciosos se conserva el último estado válido.
        if (!silent) {
          setRoomsError(error.message);
          setRoomsStatus("error");
        }
      }
    },
    [guard]
  );

  const getRoom = useCallback((id) => rooms.find((r) => r.id === String(id)) ?? null, [rooms]);

  /** Trae la sala del servidor; devuelve null si ya no existe. */
  const loadRoom = useCallback(
    async (id) => {
      try {
        const room = await guard(() => fetchSala(id));
        upsertRoom(room);
        return room;
      } catch (error) {
        if (error.status === 404) {
          removeRoom(id);
          return null;
        }
        throw error;
      }
    },
    [guard, upsertRoom, removeRoom]
  );

  const createRoom = useCallback(
    async (data) => {
      const room = await guard(() => createSala(data));
      upsertRoom(room);
      return room;
    },
    [guard, upsertRoom]
  );

  const joinRoom = useCallback(
    async (id) => {
      const room = await guard(() => joinSala(id));
      upsertRoom(room);
      return room;
    },
    [guard, upsertRoom]
  );

  /** Devuelve null si la sala se eliminó al quedar vacía. */
  const leaveRoom = useCallback(
    async (id) => {
      const room = await guard(() => leaveSala(id));
      if (room) upsertRoom(room);
      else removeRoom(id);
      return room;
    },
    [guard, upsertRoom, removeRoom]
  );

  /* ---- Perfil ---- */

  const updateUser = useCallback(
    async (patch) => {
      const saved = await guard(() => updateCurrentUser(patch));
      setUser(saved);
      // Las salas muestran nombre y géneros de cada miembro: refrescarlas si cambiaron.
      if ((patch.name !== undefined || patch.genres !== undefined) && roomsStatus === "ready") {
        loadRooms();
      }
      return saved;
    },
    [guard, loadRooms, roomsStatus]
  );

  const deleteAccount = useCallback(async () => {
    await guard(deleteCurrentUser);
    endSession();
  }, [guard, endSession]);

  const value = useMemo(
    () => ({
      user,
      authStatus,
      rooms,
      roomsStatus,
      roomsError,
      logout,
      updateUser,
      deleteAccount,
      loadRooms,
      getRoom,
      loadRoom,
      createRoom,
      joinRoom,
      leaveRoom,
      guard,
    }),
    [
      user,
      authStatus,
      rooms,
      roomsStatus,
      roomsError,
      logout,
      updateUser,
      deleteAccount,
      loadRooms,
      getRoom,
      loadRoom,
      createRoom,
      joinRoom,
      leaveRoom,
      guard,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
