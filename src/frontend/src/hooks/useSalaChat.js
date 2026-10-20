import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChatTicket } from "../services/salaService";
import { formatMessageTime } from "../utils/format";

const MAX_RETRY_DELAY_MS = 15000;

let sequence = 0;

function toMessage({ userId, username, content, timestamp }) {
  sequence += 1;
  return {
    id: `m${sequence}`,
    authorId: userId ?? username,
    author: username,
    time: formatMessageTime(timestamp),
    text: content,
  };
}

function chatUrl(ticket) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws/chat?ticket=${encodeURIComponent(ticket)}`;
}

/**
 * Chat en tiempo real de una sala (chat-controller por WebSocket).
 * Cada conexión pide un ticket nuevo al reunion-controller, que solo lo emite a miembros.
 */
export default function useSalaChat(salaId, enabled) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !salaId) {
      setMessages([]);
      setStatus("idle");
      return undefined;
    }

    let cancelled = false;
    let attempt = 0;
    let timer = null;

    const scheduleReconnect = () => {
      const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
      attempt += 1;
      timer = setTimeout(connect, delay);
    };

    async function connect() {
      setStatus("connecting");
      let ticket;
      try {
        ticket = await fetchChatTicket(salaId);
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        if (![401, 403, 404].includes(error.status)) scheduleReconnect();
        return;
      }
      if (cancelled) return;

      const socket = new WebSocket(chatUrl(ticket));
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus("open");
      };

      socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "history" && Array.isArray(data.payload)) {
          setMessages(data.payload.map(toMessage));
        } else if (data.type === "message" && data.payload) {
          setMessages((prev) => [...prev, toMessage(data.payload)]);
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (cancelled) return;
        setStatus("connecting");
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [salaId, enabled]);

  const send = useCallback((text) => {
    const socket = socketRef.current;
    const content = text.trim();
    if (!content || !socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ content }));
    return true;
  }, []);

  return { messages, status, send };
}
