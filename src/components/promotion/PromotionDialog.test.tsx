import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PromotionDialog } from "@/components/promotion/PromotionDialog";

describe("PromotionDialog", () => {
  it("selects the knight on click", async () => {
    const onSelect = vi.fn();
    render(
      <PromotionDialog color="w" onSelect={onSelect} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await userEvent.click(screen.getByRole("button", { name: "Cavalo" }));
    expect(onSelect).toHaveBeenCalledWith("n");
  });

  it("uses the pieces of the given color", () => {
    const { container } = render(
      <PromotionDialog color="b" onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    const srcs = Array.from(container.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toEqual([
      "/pieces/bQ.svg",
      "/pieces/bR.svg",
      "/pieces/bB.svg",
      "/pieces/bN.svg",
    ]);
  });

  it("cancels with Escape", async () => {
    const onCancel = vi.fn();
    render(
      <PromotionDialog color="w" onSelect={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps focus trapped inside", async () => {
    render(<PromotionDialog color="w" onSelect={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
