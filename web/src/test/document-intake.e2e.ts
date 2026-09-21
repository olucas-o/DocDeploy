import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { DocumentUploadForm } from "../features/documents/DocumentUploadForm";

describe("document intake", () => {
  it("submits compatible metadata and reports an oversized file accessibly", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(createElement(DocumentUploadForm, { onSubmit }));
    const fileInput = screen.getByLabelText("Arquivo");
    expect(fileInput).toHaveAttribute("accept", "application/pdf,image/png,image/jpeg");

    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [oversized] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("25 MB");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a compatible document with its minimum metadata", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(createElement(DocumentUploadForm, { onSubmit }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Contrato" } });
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "Fornecedor" } });
    fireEvent.change(screen.getByLabelText("Recebido em"), { target: { value: "2026-09-21T12:00" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "11111111-1111-4111-8111-111111111111" } });
    const file = new File(["%PDF-1.7"], "contrato.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo"), { target: { files: [file] } });
    fireEvent.submit(screen.getByRole("button", { name: "Registrar documento" }).closest("form")!);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ name: "Contrato", type: "contract", origin: "Fornecedor", fileName: "contrato.pdf" });
  });
});
