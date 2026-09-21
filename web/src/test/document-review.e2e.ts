import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReviewPanel } from "../features/reviews/ReviewPanel";

describe("document review", () => {
  it("corrects a field, creates a task and records a justified decision", async () => {
    const onCorrect = vi.fn().mockResolvedValue(undefined);
    const onCreateTask = vi.fn().mockResolvedValue(undefined);
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(createElement(ReviewPanel, {
      fields: [{ id: "field-1", key: "value", value: "100", source: "page 1", confidence: 0.7, reviewState: "NEEDS_REVIEW" }],
      tasks: [], onCorrect, onCreateTask, onResolveTask: vi.fn(), onDecide,
    }));
    fireEvent.change(screen.getByLabelText("Valor value"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Justificativa da correção"), { target: { value: "Conferido na página 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
    await vi.waitFor(() => expect(onCorrect).toHaveBeenCalledWith("field-1", "120", "Conferido na página 1"));
    fireEvent.change(screen.getByLabelText("Nova pendência"), { target: { value: "Validar emissor" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar pendência" }));
    await vi.waitFor(() => expect(onCreateTask).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Justificativa da decisão"), { target: { value: "Dados incompletos" } });
    fireEvent.click(screen.getByRole("button", { name: "Devolver para complemento" }));
    await vi.waitFor(() => expect(onDecide).toHaveBeenCalledWith("RETURNED_FOR_COMPLEMENT", "Dados incompletos"));
  });
});
