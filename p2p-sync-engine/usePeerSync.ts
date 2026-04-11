import { useState, useEffect, useCallback, useRef } from "react";
import Peer, { type DataConnection } from "peerjs";
import { generateSyncCode } from "./generateCode";

export type SyncStatus =
  | "idle"
  | "initializing"
  | "waiting"
  | "connecting"
  | "connected"
  | "sending"
  | "receiving"
  | "success"
  | "error";

interface UsePeerSyncOptions {
  remotePeerId?: string;
}

interface UsePeerSyncReturn {
  status: SyncStatus;
  peerId: string | null;
  error: string | null;
  send: (data: unknown) => void;
  receivedData: unknown | null;
  disconnect: () => void;
}

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
};

const MAX_RETRIES = 3;

export function usePeerSync({
  remotePeerId,
}: UsePeerSyncOptions = {}): UsePeerSyncReturn {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [peerId, setPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedData, setReceivedData] = useState<unknown | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<SyncStatus>("idle");

  // Keep a ref in sync so event handlers see current status
  statusRef.current = status;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    // Clean up previous peer on retry
    connRef.current?.close();
    peerRef.current?.destroy();

    setStatus("initializing");
    setError(null);

    const customId = remotePeerId ? undefined : generateSyncCode();
    const peer = customId
      ? new Peer(customId, PEER_CONFIG)
      : new Peer(PEER_CONFIG);
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);

      if (remotePeerId) {
        setStatus("connecting");
        const conn = peer.connect(remotePeerId, { reliable: true });
        connRef.current = conn;

        timeoutRef.current = setTimeout(() => {
          if (
            statusRef.current === "connecting" ||
            statusRef.current === "initializing"
          ) {
            setError(
              "Connection timed out. The other device may have closed the page.",
            );
            setStatus("error");
            conn.close();
          }
        }, 15000);

        conn.on("open", () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setStatus("receiving");
        });

        conn.on("data", (data) => {
          setReceivedData(data);
          setStatus("success");
        });

        conn.on("error", (err) => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setError(err.message || "Connection failed");
          setStatus("error");
        });

        conn.on("close", () => {
          if (statusRef.current !== "success") {
            setError("Connection closed unexpectedly");
            setStatus("error");
          }
        });
      } else {
        setStatus("waiting");
      }
    });

    peer.on("connection", (conn) => {
      connRef.current = conn;
      conn.on("open", () => setStatus("connected"));
      conn.on("error", (err) => {
        setError(err.message || "Connection error");
        setStatus("error");
      });
    });

    peer.on("error", (err) => {
      const msg = err.message || "Peer error";

      // ID collision on PeerJS cloud — retry with a new code
      if (
        (msg.includes("is taken") || msg.includes("unavailable")) &&
        retryCount < MAX_RETRIES
      ) {
        peer.destroy();
        setRetryCount((c) => c + 1);
        return;
      }

      if (msg.includes("Could not connect to peer")) {
        setError("Peer not found. The other device may have closed the page.");
      } else if (msg.includes("Lost connection")) {
        setError("Lost connection to signaling server");
      } else {
        setError(msg);
      }
      setStatus("error");
    });

    peer.on("disconnected", () => {
      if (statusRef.current !== "success" && statusRef.current !== "error") {
        peer.reconnect();
      }
    });
  }, [remotePeerId, retryCount]);

  const send = useCallback((data: unknown) => {
    const conn = connRef.current;
    if (!conn || !conn.open) {
      setError("No active connection");
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      conn.send(data);
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send data");
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    connRef.current?.close();
    peerRef.current?.destroy();
    peerRef.current = null;
    connRef.current = null;
    setStatus("idle");
    setPeerId(null);
  }, []);

  return { status, peerId, error, send, receivedData, disconnect };
}
