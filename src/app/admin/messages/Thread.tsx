"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { useT } from "@/i18n/client";
import type { LiveMessage } from "@/lib/realtime";
import { sendHrMessage, sendInvitation } from "../candidates/message-actions";
import { ackConversation } from "./actions";

export function Thread({
  appId,
  token,
  initial,
  localeTag,
  hrName,
  canWrite,
  canInvite,
}: {
  appId: string;
  token: string;
  initial: LiveMessage[];
  localeTag: string;
  hrName: string;
  canWrite: boolean;
  canInvite: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const ack = async (level: "delivered" | "read") => {
    const changed = await ackConversation(appId, level);
    if (changed > 0 && level === "read") router.refresh();
  };

  return (
    <ChatView
      me="hr"
      token={token}
      appId={appId}
      initial={initial}
      send={(text) => sendHrMessage(appId, text)}
      localeTag={localeTag}
      hrName={hrName}
      canWrite={canWrite}
      ack={ack}
      extra={
        canInvite ? (
          <button
            type="button"
            disabled={pending}
            className="btn"
            onClick={() => {
              if (!confirm(t("hr1.chat.inviteConfirm"))) return;
              start(async () => {
                const res = await sendInvitation(appId);
                alert(res.ok ? t("hr1.chat.inviteSent") : (res.error ?? ""));
              });
            }}
          >
            {t("hr1.chat.invite")}
          </button>
        ) : null
      }
    />
  );
}
