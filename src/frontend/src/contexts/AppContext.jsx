import { createContext, useContext, useState, useCallback } from "react";
import { mockRooms, mockMessages } from "../services/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [view, setView] = useState("landing");
  const [user, setUser] = useState({ name: "", genres: [] });
  const [rooms, setRooms] = useState(mockRooms);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState(mockMessages);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefillModal, setPrefillModal] = useState(null);

  const handleJoin = useCallback((room) => {
    setActiveRoom(room);
    setView("chat");
  }, []);

  const createRoom = useCallback((e) => {
    e.preventDefault();
    const form = e.target;
    const newRoom = {
      id: Date.now(),
      movie: form.movie.value,
      place: form.place.value,
      date: form.date.value,
      time: form.time.value,
      host: form.host.value,
      members: 1,
    };
    setRooms((prev) => [newRoom, ...prev]);
    setIsModalOpen(false);
    setPrefillModal(null);
  }, []);

  const sendMessage = useCallback((e) => {
    e.preventDefault();
    const text = e.target.msg.value;
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), user: user.name, text },
    ]);
    e.target.reset();
  }, [user.name]);

  const openModalWithMovie = useCallback((movie) => {
    setPrefillModal(movie);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPrefillModal(null);
  }, []);

  const value = {
    view, setView,
    user, setUser,
    rooms, setRooms,
    activeRoom, setActiveRoom,
    messages, setMessages,
    isModalOpen, setIsModalOpen,
    prefillModal, setPrefillModal,
    handleJoin,
    createRoom,
    sendMessage,
    openModalWithMovie,
    closeModal,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
