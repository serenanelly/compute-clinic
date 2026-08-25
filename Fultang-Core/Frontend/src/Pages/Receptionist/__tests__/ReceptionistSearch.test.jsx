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

describe("Receptionist - Fonctionnalité de Recherche", () => {
    it("devrait filtrer la liste lorsqu'on saisit une recherche", async () => {
        const user = userEvent.setup();
        render(
            <BrowserRouter>
                <Receptionist />
            </BrowserRouter>
        );

        // Attendre que les données initiales soient là
        await screen.findByText(/Atangana Marie/i);

        const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
        
        // On tape lentement pour déclencher le debounce
        await user.type(searchInput, "Mvondo");

        // Attendre que Atangana Marie disparaisse (preuve que le filtrage a eu lieu)
        await waitFor(() => {
            expect(screen.queryByText(/Atangana Marie/i)).not.toBeInTheDocument();
        }, { timeout: 3000 });

        expect(screen.getByText(/Mvondo Jean/i)).toBeInTheDocument();
        expect(screen.queryByText(/Kotto Paul/i)).not.toBeInTheDocument();
    });

    it("devrait afficher 'Aucun résultat' si la recherche ne correspond à rien", async () => {
        const user = userEvent.setup();
        render(
            <BrowserRouter>
                <Receptionist />
            </BrowserRouter>
        );

        await screen.findByText(/Mvondo Jean/i);

        const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
        await user.type(searchInput, "UtilisateurInexistant");

        await waitFor(() => {
            expect(screen.getByText(/Aucun résultat/i)).toBeInTheDocument();
        }, { timeout: 3000 });
        
        expect(screen.queryByText(/Mvondo Jean/i)).not.toBeInTheDocument();
    });
});
