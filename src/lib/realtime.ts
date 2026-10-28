export type LiveMessage = {
  id: string;
  sender: string;
  sender_name: string | null;
  body: string;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
};

export type Receipt = { ids: string[]; level: "delivered" | "read"; at: string };

// Canal WebSocket secret du candidat : son nom contient le jeton de suivi (impossible à deviner).
export const trackChannel = (token: string) => `track:${token}`;

// Serveur seulement : envoie un événement en direct au candidat qui a sa page de suivi ouverte.
async function broadcast(token: string, event: "msg" | "receipt", payload: unknown) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({ messages: [{ topic: trackChannel(token), event, payload, private: false }] }),
    });
  } catch (e) {
    console.error("broadcast", event, e);
  }
}

export const broadcastToCandidate = (token: string, message: LiveMessage) => broadcast(token, "msg", message);
export const broadcastReceipt = (token: string, receipt: Receipt) => broadcast(token, "receipt", receipt);
