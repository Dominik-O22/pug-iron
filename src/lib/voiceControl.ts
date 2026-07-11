import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from "expo-speech-recognition";

import { parseVoiceIntent, type VoiceIntent } from "../logic/voice";

export type VoiceStatus =
  | "listening"
  | "muted"
  | "denied"
  | "no-model"
  | "unavailable";

const ON_DEVICE_SERVICE = "com.google.android.as";

// Hands-free set logging: on-device recognition only (never network), active
// solely while the logger screen is mounted, mutable via the header kill toggle.
export function useVoiceControl({
  onIntent
}: {
  onIntent: (intent: VoiceIntent) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("unavailable");
  const statusRef = useRef(status);
  statusRef.current = status;
  const onIntentRef = useRef(onIntent);
  onIntentRef.current = onIntent;
  // The "end" rejoin must never re-arm the mic after the logger closes: an
  // abort() on unmount still emits "end" while statusRef reads "listening".
  const desiredRef = useRef(false);

  const startRecognition = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false
      });
    } catch (error: unknown) {
      console.error("Voice start failed", error);
      setStatus("unavailable");
    }
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Aborting an idle recognizer is fine to ignore.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    desiredRef.current = true;

    (async () => {
      try {
        if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
          if (!cancelled) {
            setStatus("unavailable");
          }
          return;
        }

        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

        if (cancelled) {
          return;
        }

        if (!permission.granted) {
          setStatus("denied");
          return;
        }

        // On-device only: require the offline English model before arming the
        // mic, instead of finding out via an opaque start() error.
        const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
          androidRecognitionServicePackage: ON_DEVICE_SERVICE
        });

        if (cancelled) {
          return;
        }

        if (!installedLocales.some((locale) => locale.startsWith("en"))) {
          setStatus("no-model");
          return;
        }

        setStatus("listening");
        startRecognition();
      } catch (error: unknown) {
        console.error("Voice setup failed", error);

        if (!cancelled) {
          setStatus("unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
      desiredRef.current = false;
      stopRecognition();
    };
  }, [startRecognition, stopRecognition]);

  // Backgrounding the app must release the mic; foregrounding rejoins only if
  // the user hadn't killed it.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        stopRecognition();
        return;
      }

      if (desiredRef.current && statusRef.current === "listening") {
        startRecognition();
      }
    });

    return () => subscription.remove();
  }, [startRecognition, stopRecognition]);

  useSpeechRecognitionEvent("result", (event) => {
    if (statusRef.current !== "listening" || !event.isFinal) {
      return;
    }

    const transcript = event.results[0]?.transcript ?? "";
    const intent = parseVoiceIntent(transcript);

    if (intent) {
      onIntentRef.current(intent);
    }
  });

  // Android segments continuous sessions: every final result (and some errors)
  // ends the session, so rejoin whenever we still want to be listening.
  useSpeechRecognitionEvent("end", () => {
    if (
      desiredRef.current &&
      statusRef.current === "listening" &&
      AppState.currentState === "active"
    ) {
      startRecognition();
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    // no-speech is routine silence during rest, aborted is our own stop
    // (DESIGN: never nag). The "end" rejoin keeps the session alive after both.
    if (event.error === "no-speech" || event.error === "aborted") {
      return;
    }

    if (event.error === "not-allowed") {
      setStatus("denied");
      return;
    }

    // A missing/uninstalled offline model surfaces as either of these
    // depending on the device; both mean "voice can't work right now".
    if (event.error === "language-not-supported" || event.error === "service-not-allowed") {
      setStatus("no-model");
      return;
    }

    console.error("Voice recognition error", event.error, event.message);
    setStatus("unavailable");
  });

  const toggle = useCallback(() => {
    if (statusRef.current === "listening") {
      setStatus("muted");
      stopRecognition();
      return;
    }

    if (statusRef.current === "muted") {
      setStatus("listening");
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  return { status, toggle };
}
