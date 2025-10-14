import { useWebSocket } from "../lib/websocket";

export default function Home() {
  const { message, isConnected } = useWebSocket();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">ARBITRAGEXPLUS2025 Frontend</h1>
      <p className="text-lg">WebSocket Status: {isConnected ? "Connected" : "Disconnected"}</p>
      {message && <p className="text-md">Last Message: {message}</p>}
    </main>
  );
}

