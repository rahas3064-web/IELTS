/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/src/i18n";
import { ProfileStep } from "@/components/features/bandora/panel/auth/profile-step";

const post = vi.fn(async (_path: string, _body?: unknown) => ({ user: { id: "u" }, referral: null }));
const refresh = vi.fn(async () => null);

vi.mock("@/src/lib/api-client", () => ({
  api: { post: (...args: [string, unknown?]) => post(...args) },
  ApiClientError: class ApiClientError extends Error {
    status = 400;
  },
}));

vi.mock("@/src/auth/auth-provider", () => ({
  useAuth: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  post.mockClear();
});

function draw() {
  return render(
    <I18nProvider locale="fa">
      <MemoryRouter>
        <ProfileStep signupToken="token" initialReferral="" onExpired={() => {}} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("profile acceptance", () => {
  it("does not register until the legal documents are accepted", async () => {
    const user = userEvent.setup();
    draw();
    await user.type(screen.getByLabelText("نام"), "سارا");
    await user.type(screen.getByLabelText("نام خانوادگی"), "احمدی");
    await user.click(screen.getByRole("button", { name: "ادامه" }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("قبول");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "ادامه" }));
    expect(post).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ acceptedLegal: true }));
  });
});
