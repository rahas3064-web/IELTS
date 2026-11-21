/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { BandoraFooter } from "@/components/features/bandora/header";

const ENAMAD_HREF = "https://trustseal.enamad.ir/?id=8815501&Code=2Tsc6O5b6CL8gxvGp4hsJDH0N6wCTRgn";
const ENAMAD_SRC = "https://trustseal.enamad.ir/logo.aspx?id=8815501&Code=2Tsc6O5b6CL8gxvGp4hsJDH0N6wCTRgn";
const ENAMAD_CODE = "2Tsc6O5b6CL8gxvGp4hsJDH0N6wCTRgn";

describe("landing footer eNamad seal", () => {
  it("renders the trust seal beside the copyright line", () => {
    render(<BandoraFooter />);

    const footer = screen.getByRole("contentinfo");
    const seal = screen.getByRole("link", { name: "نماد اعتماد الکترونیکی" });
    const logo = screen.getByRole("img", { name: "نماد اعتماد الکترونیکی" });

    expect(footer).toContainElement(seal);
    expect(seal).toHaveAttribute("href", ENAMAD_HREF);
    expect(seal).toHaveAttribute("target", "_blank");
    expect(seal).toHaveAttribute("referrerpolicy", "origin");
    expect(seal).toContainElement(logo);
    expect(logo).toHaveAttribute("src", ENAMAD_SRC);
    expect(logo).toHaveAttribute("referrerpolicy", "origin");
    expect(logo).toHaveAttribute("code", ENAMAD_CODE);
    expect(logo).toHaveStyle({ cursor: "pointer", height: "80px" });
    expect(footer).toHaveTextContent("© 2026 Bandora. All rights reserved.");
    expect(footer).toHaveTextContent("آمادگی آیلتس، با یک مسیر مشخص و هدفمند.");
  });
});
