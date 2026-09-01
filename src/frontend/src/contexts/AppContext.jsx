import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { CURRENT_USER_ID, mockRooms, mockMessages } from "../services/mockData";
import {
  deleteCurrentUser,
  fetchCurrentUser,
  logoutRequest,
  updateCurrentUser,
} from "../services/authService";
import { currentTime } from "../utils/format";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [rooms, setRooms] = useState(mockRooms);
  const [messages, setMessages] = useState(mockMessages);

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

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setAuthStatus("anonymous");
    }
  }, []);

  const updateUser = useCallback(async (patch) => {
    const saved = await updateCurrentUser(patch);
    setUser(saved);

    // Nombre y géneros viajan denormalizados en salas y mensajes: sincronizarlos.
    const memberPatch = {};
    if (patch.name !== undefined) memberPatch.name = saved.name;
    if (patch.genres !== undefined) memberPatch.genres = saved.genres;
    if (Object.keys(memberPatch).length === 0) return saved;

    setRooms((rs) =>
      rs.map((room) => ({
        ...room,
        members: room.members.map((m) =>
          m.id === CURRENT_USER_ID ? { ...m, ...memberPatch } : m
        ),
      }))
    );

    if (patch.name !== undefined) {
      setMessages((ms) =>
        ms.map((m) => (m.authorId === CURRENT_USER_ID ? { ...m, author: saved.name } : m))
      );
    }

    return saved;
  }, []);

  const deleteAccount = useCallback(async () => {
    await deleteCurrentUser();

    // Salas y mensajes siguen siendo mock en memoria: limpiarlos acá.
    setRooms((rs) =>
      rs.map((room) => ({
        ...room,
        members: room.members.filter((m) => m.id !== CURRENT_USER_ID),
      }))
    );
    setMessages((ms) => ms.filter((m) => m.authorId !== CURRENT_USER_ID));
    setUser(null);
    setAuthStatus("anonymous");
  }, []);

  /* ---- Salas ---- */

  const getRoom = useCallback((id) => rooms.find((r) => r.id === String(id)) ?? null, [rooms]);

  const createRoom = useCallback(
    ({ movie, place, date, time, capacity, note }) => {
      const room = {
        id: String(Date.now()),
        movie,
        place,
        date,
        time,
        host: user?.name ?? "Anónimo",
        capacity,
        note,
        members: [
          {
            id: CURRENT_USER_ID,
            name: user?.name ?? "Anónimo",
            genres: user?.genres ?? [],
            isAdmin: true,
          },
        ],
      };
      setRooms((prev) => [room, ...prev]);
      return room;
    },
    [user]
  );

  const joinRoom = useCallback(
    (roomId) => {
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== roomId) return room;
          if (room.members.some((m) => m.id === CURRENT_USER_ID)) return room;
          if (room.members.length >= room.capacity) return room;
          return {
            ...room,
            members: [
              ...room.members,
              { id: CURRENT_USER_ID, name: user?.name ?? "Anónimo", genres: user?.genres ?? [] },
            ],
          };
        })
      );
    },
    [user]
  );

  const leaveRoom = useCallback((roomId) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? { ...room, members: room.members.filter((m) => m.id !== CURRENT_USER_ID) }
          : room
      )
    );
  }, []);

  /* ---- Chat ---- */

  const getMessages = useCallback(
    (roomId) => messages.filter((m) => m.roomId === roomId),
    [messages]
  );

  const sendMessage = useCallback(
    (roomId, text) => {
      const clean = text.trim();
      if (!clean) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `m${Date.now()}`,
          roomId,
          authorId: CURRENT_USER_ID,
          author: user?.name ?? "Anónimo",
          time: currentTime(),
          text: clean,
        },
      ]);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      authStatus,
      rooms,
      logout,
      updateUser,
      deleteAccount,
      getRoom,
      createRoom,
      joinRoom,
      leaveRoom,
      getMessages,
      sendMessage,
    }),
    [
      user,
      authStatus,
      rooms,
      logout,
      updateUser,
      deleteAccount,
      getRoom,
      createRoom,
      joinRoom,
      leaveRoom,
      getMessages,
      sendMessage,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
