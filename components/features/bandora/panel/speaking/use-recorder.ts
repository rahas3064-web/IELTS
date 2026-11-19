import { useEffect, useRef, useState } from "react";
import { elapsedSec, pickRecordingMime, RECORDING_BITS_PER_SECOND, recordingLimitSec, type SpeakingPart } from "./recorder-rules";

export type RecorderPhase = "idle" | "recording" | "ready" | "denied" | "unsupported" | "error";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useRecorder(part: SpeakingPart) {
  const limit = recordingLimitSec(part);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function clearTimer() {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function replaceUrl(next: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setAudioUrl(next);
  }

  useEffect(() => () => {
    clearTimer();
    stopStream(streamRef.current);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("unsupported");
      return;
    }
    const chosen = pickRecordingMime((type) => MediaRecorder.isTypeSupported(type));
    if (!chosen) {
      setPhase("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: chosen, audioBitsPerSecond: RECORDING_BITS_PER_SECOND });
      } catch {
        recorder = new MediaRecorder(stream, { mimeType: chosen });
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chosen });
        replaceUrl(URL.createObjectURL(blob));
        setMime(chosen);
        setPhase("ready");
        clearTimer();
        stopStream(streamRef.current);
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      const startedAt = Date.now();
      setElapsed(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        const next = elapsedSec(startedAt, Date.now(), limit);
        setElapsed(next);
        if (next >= limit && recorder.state !== "inactive") recorder.stop();
      }, 250);
    } catch (error) {
      clearTimer();
      stopStream(streamRef.current);
      streamRef.current = null;
      const name = error instanceof DOMException ? error.name : "";
      setPhase(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function discard() {
    clearTimer();
    replaceUrl(null);
    setMime(null);
    setElapsed(0);
    setPhase("idle");
  }

  return { phase, elapsed, limit, remaining: limit - elapsed, audioUrl, mime, start, stop, discard };
}
