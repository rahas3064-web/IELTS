/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/src/i18n";
import { SpeakingRecorder } from "./recorder";

class FakeRecorder {
  static supported = new Set(["audio/webm;codecs=opus"]);
  static lastOptions: { audioBitsPerSecond?: number } | null = null;
  static isTypeSupported(type: string) {
    return FakeRecorder.supported.has(type);
  }

  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: unknown, options?: { audioBitsPerSecond?: number }) {
    FakeRecorder.lastOptions = options ?? null;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

function draw(part: 1 | 2 | 3 = 1) {
  return render(
    <I18nProvider locale="fa">
      <SpeakingRecorder part={part} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeRecorder.supported = new Set(["audio/webm;codecs=opus"]);
});

function allowObjectUrls() {
  URL.createObjectURL = vi.fn(() => "blob:recording");
  URL.revokeObjectURL = vi.fn();
}

describe("speaking recorder", () => {
  it("records compressed audio and then offers replay", async () => {
    const stop = vi.fn();
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
      },
    });
    const user = userEvent.setup();
    allowObjectUrls();
    draw();
    await user.click(screen.getByRole("button", { name: "شروع ضبط" }));
    expect(screen.getByRole("button", { name: "پایان ضبط" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "پایان ضبط" }));
    expect(screen.getByRole("button", { name: "ضبط دوباره" })).toBeInTheDocument();
    expect(screen.getByLabelText("پخش ضبط")).toHaveAttribute("src", "blob:recording");
    expect(stop).toHaveBeenCalled();
    expect(FakeRecorder.lastOptions?.audioBitsPerSecond).toBe(48_000);
  });

  it("explains a denied microphone", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("no", "NotAllowedError");
        }),
      },
    });
    const user = userEvent.setup();
    draw();
    await user.click(screen.getByRole("button", { name: "شروع ضبط" }));
    expect(screen.getByRole("alert")).toHaveTextContent("اجازهٔ میکروفون");
  });

  it("explains when the browser cannot record webm or mp4", async () => {
    FakeRecorder.supported = new Set();
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    const user = userEvent.setup();
    draw();
    await user.click(screen.getByRole("button", { name: "شروع ضبط" }));
    expect(screen.getByRole("alert")).toHaveTextContent("پشتیبانی نمی‌کند");
  });
});
