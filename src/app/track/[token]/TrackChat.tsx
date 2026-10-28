"use client";

import { ChatView } from "@/components/chat/ChatView";
import type { LiveMessage } from "@/lib/realtime";
import { ackHrMessages, sendCandidateMessage } from "./actions";

// Chat du candidat : messages en direct, sans recharger la page.
export function TrackChat({ token, initial, localeTag, hrName }: { token: string; initial: LiveMessage[]; localeTag: string; hrName: string }) {
  return (
    <ChatView
      me="candidate"
      token={token}
      appId=""
      initial={initial}
      send={(text) => sendCandidateMessage(token, text)}
      localeTag={localeTag}
      hrName={hrName}
      canWrite
      ack={(level) => ackHrMessages(token, level)}
    />
  );
}
