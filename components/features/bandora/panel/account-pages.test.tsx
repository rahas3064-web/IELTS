/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/src/i18n";
import { ProfilePage } from "@/components/features/bandora/panel/account-pages";

const post = vi.fn(async (_path: string, _body?: unknown) => ({ ok: true }));
const logout = vi.fn(async () => undefined);

vi.mock("@/src/lib/api-client", () => ({
  api: { post: (...args: [string, unknown?]) => post(...args) },
}));

vi.mock("@/src/auth/auth-provider", () => ({
  useAuth: () => ({
    me: { user: { firstName: "سارا", lastName: "احمدی", phone: "09120000000", email: null } },
    logout,
  }),
}));

afterEach(() => {
  cleanup();
  post.mockClear();
  logout.mockClear();
});

function draw() {
  return render(
    <I18nProvider locale="fa">
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("profile account deletion", () => {
  it("deletes the account only after the word حذف is typed", async () => {
    const user = userEvent.setup();
    draw();
    await user.click(screen.getByRole("button", { name: "حذف حساب" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "حذف حساب" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("تأیید حذف"), "نه");
    expect(confirm).toBeDisabled();
    expect(post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("تأیید حذف"));
    await user.type(screen.getByLabelText("تأیید حذف"), "حذف");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(post).toHaveBeenCalledWith("/api/account/delete", { confirmation: "حذف" });
    expect(logout).toHaveBeenCalled();
  });
});
