import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Appointments } from "../Appointments";
import { BrowserRouter } from "react-router-dom";

vi.mock("../../../Utils/Provider.jsx", () => ({
    useAuthentication: () => ({
        isAuthenticated: () => true,
        hasRole: () => true,
        userData: { id: 1, nom: "Agent Test" },
    }),
}));

vi.mock("../../GlobalComponents/DashBoard", () => ({
    DashBoard: ({ children }) => <div data-testid="dashboard-mock">{children}</div>,
}));

describe("Planning RDV réception — lecture seule", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("affiche la liste des rendez-vous au chargement", async () => {
        render(
            <BrowserRouter>
                <Appointments />
            </BrowserRouter>,
        );

        expect(await screen.findByText(/Planning RDV/i)).toBeInTheDocument();
        expect(await screen.findByText(/Mvondo Jean/i)).toBeInTheDocument();
    });

    it("n'affiche pas de bouton de création ni de légende de statuts", async () => {
        render(
            <BrowserRouter>
                <Appointments />
            </BrowserRouter>,
        );

        await screen.findByText(/Planning RDV/i);
        expect(screen.queryByText(/Nouveau Rendez-vous/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Programmé/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Confirmer/i)).not.toBeInTheDocument();
    });
});
