import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Appointments } from "../Appointments";
import { BrowserRouter } from "react-router-dom";

// Mock global pour éviter les effets de bord
vi.mock("../../../Utils/Provider.jsx", () => ({
    useAuthentication: () => ({
        isAuthenticated: () => true,
        hasRole: () => true,
        userData: { id: 1, nom: "Agent Test" }
    })
}));

// Mock du DashBoard pour s'assurer qu'il n'interfère pas
vi.mock("../../GlobalComponents/DashBoard", () => ({
    DashBoard: ({ children }) => <div data-testid="dashboard-mock">{children}</div>
}));

describe("Gestion des Rendez-vous - Tests Réceptionniste", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("devrait afficher la liste des rendez-vous au chargement", async () => {
        render(
            <BrowserRouter>
                <Appointments />
            </BrowserRouter>
        );

        // Attendre que le titre apparaisse
        expect(await screen.findByText(/Planning RDV/i)).toBeInTheDocument();

        // Attendre les données
        expect(await screen.findByText(/Mvondo Jean/i)).toBeInTheDocument();
    });

    it("devrait ouvrir le modal de planification", async () => {
        const user = userEvent.setup();
        render(
            <BrowserRouter>
                <Appointments />
            </BrowserRouter>
        );

        const newBtn = await screen.findByText(/Nouveau Rendez-vous/i);
        await user.click(newBtn);

        // On vérifie le titre du modal
        expect(await screen.findByText(/Planifier un rendez-vous/i)).toBeInTheDocument();
    });

    it("devrait afficher les messages d'erreur si le formulaire est vide", async () => {
        const user = userEvent.setup();
        render(
            <BrowserRouter>
                <Appointments />
            </BrowserRouter>
        );

        const newBtn = await screen.findByText(/Nouveau Rendez-vous/i);
        await user.click(newBtn);
        
        const submitBtn = await screen.findByText(/Confirmer le rendez-vous/i);
        await user.click(submitBtn);

        // Attendre l'alerte d'erreur
        expect(await screen.findByText(/Veuillez remplir tous les champs obligatoires/i)).toBeInTheDocument();
    });

    it("devrait afficher un message de succès après modification d'un rendez-vous", async () => {
        const user = userEvent.setup();
        render(
            <BrowserRouter>
                <Appointments />
            </BrowserRouter>
        );

        // Attendre que les données apparaissent
        expect(await screen.findByText(/Mvondo Jean/i)).toBeInTheDocument();

        // Cliquer sur le bouton d'édition du premier RDV
        const editBtns = await screen.findAllByRole('button');
        await user.click(editBtns[1]);

        // Vérifier que le modal est ouvert
        expect(await screen.findByText(/Modifier le rendez-vous/i)).toBeInTheDocument();

        // Soumettre directement (les champs sont déjà remplis en mode édition)
        // Soumettre
        const submitBtn = screen.getByTestId('submit-button');
        fireEvent.click(submitBtn);

        // Vérifier l'apparition de l'overlay de succès
        await waitFor(() => {
            expect(screen.getByTestId('success-overlay')).toBeInTheDocument();
        }, { timeout: 10000 });

        expect(screen.getByText(/Rendez-vous enregistré !/i)).toBeInTheDocument();

        // Vérifier la fermeture automatique
        await waitFor(() => {
            expect(screen.queryByText(/Modifier le rendez-vous/i)).not.toBeInTheDocument();
        }, { timeout: 8000 });
    });
});
