"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { meetChannel } from "@/lib/live-interview";
import { createClient } from "@/lib/supabase/client";
import { endLiveInterview } from "../../admin/candidates/live-interview-actions";

type Stage = "lobby" | "room" | "left" | "over";
type Peer = "absent" | "connecting" | "connected" | "reconnecting";
type Chat = { mine: boolean; text: string };

const MAX_CHAT = 500;

// Salle de visio 1 à 1. La vidéo et le son passent directement d'un navigateur à l'autre (WebRTC) ;
// Supabase Realtime sert seulement à mettre les deux personnes en relation. Rien n'est enregistré.
export function MeetRoom({ token, role, liveId, iceServers, peerName, backHref }: { token: string; role: "host" | "guest"; liveId: string; iceServers: RTCIceServer[]; peerName: string; backHref: string }) {
  const t = useT();
  const [stage, setStage] = useState<Stage>("lobby");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peer, setPeer] = useState<Peer>("absent");
  const [netDown, setNetDown] = useState(false);
  const [chat, setChat] = useState<Chat[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");

  const stream = useRef<MediaStream | null>(null);
  const screen = useRef<MediaStream | null>(null);
  const swapVideo = useRef<(track: MediaStreamTrack) => Promise<void>>(async () => {});
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const hangup = useRef<() => void>(() => {});
  const announce = useRef<(event: string) => void>(() => {});
  const logRef = useRef<HTMLOListElement>(null);

  // Attache la caméra locale à une balise <video> (aperçu du hall et petite vignette de la salle).
  const attachLocal = (el: HTMLVideoElement | null) => {
    const src = screen.current ?? stream.current;
    if (el && src && el.srcObject !== src) el.srcObject = src;
  };

  async function enableCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") return setError(t("live.room.errSupport"));
    setBusy(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setReady(true);
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? t("live.room.errPermission") : t("live.room.errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  function toggle(kind: "audio" | "video") {
    const tracks = kind === "audio" ? stream.current?.getAudioTracks() : stream.current?.getVideoTracks();
    const next = !(tracks?.[0]?.enabled ?? true);
    tracks?.forEach((tr) => (tr.enabled = next));
    if (kind === "audio") setMicOn(next);
    else setCamOn(next);
  }

  // Partage d'écran : la vidéo de l'écran remplace celle de la caméra (replaceTrack, sans nouvelle négociation).
  async function stopShare() {
    const s = screen.current;
    if (!s) return;
    screen.current = null;
    s.getTracks().forEach((tr) => {
      tr.onended = null;
      tr.stop();
    });
    const cam = stream.current?.getVideoTracks()[0];
    if (cam) await swapVideo.current(cam);
    setSharing(false);
  }

  async function startShare() {
    setShareError("");
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
      const track = s.getVideoTracks()[0];
      track.contentHint = "detail";
      screen.current = s;
      // Le bouton "Arrêter le partage" du navigateur ramène la caméra.
      track.onended = () => void stopShare();
      await swapVideo.current(track);
      setSharing(true);
    } catch (e) {
      // Annuler la fenêtre de choix n'est pas une erreur.
      if (!(e instanceof DOMException && e.name === "NotAllowedError")) setShareError(t("live.room.errShare"));
    }
  }

  // Toute la connexion vit dans cet effet : il démarre quand on entre dans la salle et se nettoie quand on sort.
  useEffect(() => {
    if (stage !== "room" || !stream.current) return;
    const local = stream.current;
    const supabase = createClient();
    const ch = supabase.channel(meetChannel(token), { config: { broadcast: { self: false }, presence: { key: role } } });
    const otherRole = role === "host" ? "guest" : "host";
    let pc: RTCPeerConnection | null = null;
    let remoteSet = false;
    let queue: RTCIceCandidateInit[] = [];
    let lastRef = "";
    let retries = 0;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const send = (event: string, payload: unknown = {}) => void ch.send({ type: "broadcast", event, payload });

    function setupChannel(dc: RTCDataChannel) {
      dcRef.current = dc;
      dc.onopen = () => setChatReady(true);
      dc.onclose = () => setChatReady(false);
      dc.onmessage = (e) => {
        if (typeof e.data === "string") setChat((c) => [...c, { mine: false, text: e.data.slice(0, MAX_CHAT) }]);
      };
    }

    function newPc() {
      pc?.close();
      const p = new RTCPeerConnection({ iceServers });
      pc = p;
      remoteSet = false;
      const video = screen.current?.getVideoTracks()[0] ?? local.getVideoTracks()[0];
      [...local.getAudioTracks(), video].forEach((tr) => tr && p.addTrack(tr, local));
      p.onicecandidate = (e) => {
        if (e.candidate) send("ice", { c: e.candidate.toJSON() });
      };
      p.ontrack = (e) => {
        if (remoteVideo.current && remoteVideo.current.srcObject !== e.streams[0]) remoteVideo.current.srcObject = e.streams[0];
      };
      p.onconnectionstatechange = () => {
        if (p !== pc) return;
        if (p.connectionState === "connected") {
          retries = 0;
          setPeer("connected");
        } else if (p.connectionState === "disconnected") {
          setPeer("reconnecting");
        } else if (p.connectionState === "failed") {
          setPeer("reconnecting");
          // L'hôte relance la négociation (3 essais) ; le candidat attend la nouvelle offre.
          if (role === "host" && retries < 3) {
            retries += 1;
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => void offer(), 1500);
          }
        }
      };
      if (role === "host") setupChannel(p.createDataChannel("chat"));
      else p.ondatachannel = (e) => setupChannel(e.channel);
      return p;
    }

    async function flush(p: RTCPeerConnection) {
      for (const c of queue.splice(0)) {
        try {
          await p.addIceCandidate(c);
        } catch {
          /* bougie d'une ancienne session */
        }
      }
    }

    async function offer() {
      if (closed) return;
      queue = [];
      setPeer("connecting");
      const p = newPc();
      await p.setLocalDescription(await p.createOffer());
      send("offer", { sdp: p.localDescription });
    }

    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (role !== "guest" || closed) return;
      setPeer("connecting");
      const p = newPc();
      await p.setRemoteDescription(payload.sdp);
      remoteSet = true;
      await flush(p);
      await p.setLocalDescription(await p.createAnswer());
      send("answer", { sdp: p.localDescription });
    });
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (role !== "host" || !pc || closed) return;
      await pc.setRemoteDescription(payload.sdp);
      remoteSet = true;
      await flush(pc);
    });
    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (pc && remoteSet) {
        try {
          await pc.addIceCandidate(payload.c);
        } catch {
          /* bougie d'une ancienne session */
        }
      } else queue.push(payload.c);
    });
    ch.on("broadcast", { event: "ended" }, () => {
      if (role === "guest") {
        teardown();
        setStage("over");
      }
    });
    ch.on("presence", { event: "sync" }, () => {
      const metas = (ch.presenceState() as Record<string, { presence_ref?: string }[]>)[otherRole];
      const ref = metas?.[0]?.presence_ref ?? "";
      if (!ref) {
        lastRef = "";
        if (pc) {
          pc.close();
          pc = null;
        }
        setChatReady(false);
        setPeer("absent");
        return;
      }
      // Chaque arrivée de l'autre personne (y compris après un rechargement) a une nouvelle référence : l'hôte relance l'offre.
      if (ref !== lastRef) {
        lastRef = ref;
        if (role === "host") void offer();
        else setPeer("connecting");
      }
    });

    ch.subscribe((status) => {
      if (closed) return;
      if (status === "SUBSCRIBED") {
        setNetDown(false);
        void ch.track({ role, at: Date.now() });
        if (role === "guest") void fetch(`/api/meet/${token}/joined`, { method: "POST" }).catch(() => {});
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setNetDown(true);
      }
    });

    function teardown() {
      closed = true;
      screen.current?.getTracks().forEach((tr) => {
        tr.onended = null;
        tr.stop();
      });
      screen.current = null;
      clearTimeout(retryTimer);
      dcRef.current = null;
      pc?.close();
      pc = null;
      supabase.removeChannel(ch);
      local.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
    }
    swapVideo.current = async (track) => {
      const sender = pc?.getSenders().find((x) => x.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
    };
    hangup.current = teardown;
    announce.current = (event) => send(event);
    return () => {
      if (!closed) teardown();
    };
  }, [stage, token, role, iceServers]);

  // Le journal du chat descend tout seul vers le dernier message.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat]);

  function leave() {
    hangup.current();
    setPeer("absent");
    setChatReady(false);
    setReady(false);
    setSharing(false);
    setMicOn(true);
    setCamOn(true);
    setStage("left");
  }

  async function endForAll() {
    announce.current("ended");
    await endLiveInterview(liveId);
    hangup.current();
    setStage("over");
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim().slice(0, MAX_CHAT);
    if (!text || dcRef.current?.readyState !== "open") return;
    dcRef.current.send(text);
    setChat((c) => [...c, { mine: true, text }]);
    setDraft("");
  }

  if (stage === "over") {
    return (
      <div className="card grid gap-3">
        <p role="status">{t(role === "host" ? "live.room.endedHost" : "live.room.endedGuest")}</p>
        <div><Link href={backHref} className="btn">{t("live.room.back")}</Link></div>
      </div>
    );
  }

  if (stage === "lobby" || stage === "left") {
    return (
      <div className="card grid gap-4">
        <div>
          <h2 className="sub-title">{t(stage === "left" ? "live.room.leftTitle" : "live.room.lobbyTitle")}</h2>
          <p className="hint mt-1">{t("live.room.lobbyHint")}</p>
        </div>
        {ready && (
          <video ref={attachLocal} autoPlay muted playsInline className="aspect-video w-full max-w-md rounded-xl bg-black [transform:scaleX(-1)]" aria-label={t("live.room.preview")} />
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {!ready ? (
            <button type="button" disabled={busy} className="btn btn-primary btn-lg" onClick={enableCamera}>{busy ? t("live.room.enabling") : t("live.room.enable")}</button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { setChat([]); setStage("room"); }}>{t("live.room.join")}</button>
          )}
          <Link href={backHref} className="btn btn-lg">{t("live.room.back")}</Link>
        </div>
        <p className="hint">{t("live.room.noRecord")}</p>
      </div>
    );
  }

  // Les téléphones ne savent pas partager l'écran : le bouton est alors caché.
  const canShare = typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const status: Record<Peer, string> = {
    absent: t(role === "host" ? "live.room.waitGuest" : "live.room.waitHost"),
    connecting: t("live.room.connecting"),
    connected: t("live.room.connected", { name: peerName }),
    reconnecting: t("live.room.reconnecting"),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-3">
        <p className={`text-sm font-semibold ${peer === "connected" ? "text-good" : "text-muted"}`} role="status">{netDown ? t("live.room.netDown") : status[peer]}</p>
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={remoteVideo} autoPlay playsInline className="aspect-video w-full" aria-label={peerName} />
          {peer !== "connected" && <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/80">{status[peer]}</div>}
          <video ref={attachLocal} autoPlay muted playsInline className={`absolute bottom-3 end-3 aspect-video w-28 rounded-lg border-2 border-white/70 bg-black object-cover shadow-lg sm:w-40 ${sharing ? "" : "[transform:scaleX(-1)]"}`} aria-label={t("live.room.you")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" aria-pressed={!micOn} onClick={() => toggle("audio")}>{micOn ? t("live.room.muteMic") : t("live.room.unmuteMic")}</button>
          <button type="button" className="btn" aria-pressed={!camOn} onClick={() => toggle("video")}>{camOn ? t("live.room.camOff") : t("live.room.camOn")}</button>
          {canShare && (
            <button type="button" className="btn" aria-pressed={sharing} onClick={() => void (sharing ? stopShare() : startShare())}>{sharing ? t("live.room.stopShare") : t("live.room.share")}</button>
          )}
          <button type="button" className="btn btn-danger" onClick={leave}>{t("live.room.leave")}</button>
          {role === "host" &&
            (confirmEnd ? (
              <>
                <button type="button" className="btn btn-danger" onClick={() => void endForAll()}>{t("live.room.endConfirm")}</button>
                <button type="button" className="btn" onClick={() => setConfirmEnd(false)}>{t("live.room.keep")}</button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirmEnd(true)}>{t("live.room.end")}</button>
            ))}
        </div>
        {sharing && <p className="text-sm font-semibold text-primary" role="status">{t("live.room.sharing")}</p>}
        {shareError && <p className="error-text" role="alert">{shareError}</p>}
        <p className="hint">{t("live.room.noRecord")}</p>
      </div>

      <section className="card grid content-start gap-3" aria-labelledby="meet-chat-h">
        <h2 id="meet-chat-h" className="sub-title">{t("live.room.chat")}</h2>
        <ol ref={logRef} className="grid max-h-72 min-h-24 content-start gap-2 overflow-y-auto" aria-live="polite">
          {chat.length === 0 && <li className="hint">{t("live.room.chatEmpty")}</li>}
          {chat.map((m, i) => (
            <li key={i} className={`max-w-[90%] rounded-xl px-3 py-1.5 text-sm ${m.mine ? "justify-self-end bg-primary-soft" : "justify-self-start bg-surface-2"}`} dir="auto">{m.text}</li>
          ))}
        </ol>
        <form onSubmit={sendChat} className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_CHAT} disabled={!chatReady} className="field flex-1" dir="auto" aria-label={t("live.room.chatInput")} placeholder={chatReady ? t("live.room.chatInput") : t("live.room.chatWait")} />
          <button type="submit" disabled={!chatReady || !draft.trim()} className="btn btn-primary">{t("live.room.send")}</button>
        </form>
      </section>
    </div>
  );
}
