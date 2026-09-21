import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

function HomePage() {
  return <main><h1>DocDeploy</h1><p>Governança segura de documentos.</p></main>;
}

describe("application shell", () => {
  it("renders the product identity", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "DocDeploy" })).toBeInTheDocument();
  });
});
