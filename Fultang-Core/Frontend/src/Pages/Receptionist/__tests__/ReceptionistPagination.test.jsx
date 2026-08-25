import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Receptionist } from "../Receptionist";
import { BrowserRouter } from "react-router-dom";

// Mock des composants globaux
vi.mock("../../GlobalComponents/DashBoard", () => ({
    DashBoard: ({ children }) => <div data-testid="dashboard">{children}</div>
}));

vi.mock("../ReceptionistNavBar", () => ({
    ReceptionistNavBar: () => <div data-testid="navbar">NavBar</div>
}));

// Mock du Provider d'authentification
vi.mock("../../../Utils/Provider.jsx", () => ({
  useAuthentication: () => ({
    userData: { id: 1, nom: "Agent Test" },
    isAuthenticated: () => true,
    hasRole: () => true
  })
}));

describe("Receptionist - Pagination et Affichage", () => {
    it("devrait charger les patients et afficher la pagination", async () => {
        render(
            <BrowserRouter>
                <Receptionist />
            </BrowserRouter>
        );

        // Debug: voir ce qui est rendu si ça échoue
        // screen.debug();

        // Attendre que "Mvondo" apparaisse (patient index 0)
        expect(await screen.findByText(/Mvondo/i)).toBeInTheDocument();
        expect(screen.getByText(/Page 1 sur/i)).toBeInTheDocument();
    });

    it("devrait basculer entre le mode Tableau et le mode Liste", async () => {
        const user = userEvent.setup();
        render(
            <BrowserRouter>
                <Receptionist />
            </BrowserRouter>
        );

        await screen.findByText(/Mvondo/i);

        // Toggle buttons (Table vs List)
        const toggleButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg'));
        
        // Cliquer sur Table (index 0)
        await user.click(toggleButtons[0]);
        expect(await screen.findByText(/Matricule/i)).toBeInTheDocument();

        // Cliquer sur List (index 1)
        await user.click(toggleButtons[1]);
        expect(await screen.findByText(/VOIR DOSSIER/i)).toBeInTheDocument();
    });
});
