import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HospitalizedPatients } from "../HospitalizedPatients";
import { BrowserRouter } from "react-router-dom";

// Mock global pour éviter les effets de bord
vi.mock("../../../Utils/Provider.jsx", () => ({
    useAuthentication: () => ({
        isAuthenticated: () => true,
        hasRole: () => true,
        userData: { id: 1, nom: "Agent Test" }
    })
}));

// Mock du DashBoard
vi.mock("../../GlobalComponents/DashBoard", () => ({
    DashBoard: ({ children }) => <div data-testid="dashboard-mock">{children}</div>
}));

describe("Gestion des Hospitalisations - Tests Réceptionniste", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("devrait afficher la liste des hospitalisations en attente au chargement", async () => {
        render(
            <BrowserRouter>
                <HospitalizedPatients />
            </BrowserRouter>
        );

        // Attendre que le titre apparaisse
        expect(await screen.findByTestId('page-title', {}, { timeout: 8000 })).toHaveTextContent(/Hospitalisations/i);

        // Attendre les données mockées
        expect(await screen.findByText(/Kotto Paul/i, {}, { timeout: 8000 })).toBeInTheDocument();
        expect(screen.getByText(/Service: CARDIOLOGIE/i)).toBeInTheDocument();
    }, 15000);

    it("devrait ouvrir le modal de finalisation et afficher les infos immuables", async () => {
        render(
            <BrowserRouter>
                <HospitalizedPatients />
            </BrowserRouter>
        );

        const finalizeBtn = await screen.findByTestId('finalize-btn', {}, { timeout: 10000 });
        fireEvent.click(finalizeBtn);

        // Vérifier le titre du modal
        expect(await screen.findByText(/Finaliser l'Admission/i, {}, { timeout: 10000 })).toBeInTheDocument();

        // Vérifier les infos immuables
        expect(screen.getByText(/CARDIOLOGIE/i)).toBeInTheDocument();
        expect(screen.getByText(/Kotto Paul/i)).toBeInTheDocument();
    }, 20000);

    it("devrait permettre de choisir une chambre et valider l'hospitalisation", async () => {
        render(
            <BrowserRouter>
                <HospitalizedPatients />
            </BrowserRouter>
        );

        const finalizeBtn = await screen.findByTestId('finalize-btn', {}, { timeout: 10000 });
        fireEvent.click(finalizeBtn);

        // Attendre le chargement des chambres
        const roomSelect = await screen.findByTestId('room-select', {}, { timeout: 10000 });
        
        // Ouvrir le select AntD
        fireEvent.mouseDown(roomSelect.querySelector('.ant-select-selector'));
        
        // Choisir la chambre 101
        const roomOption = await screen.findByText(/Chambre 101/i, {}, { timeout: 10000 });
        fireEvent.click(roomOption);

        // Valider
        const submitBtn = screen.getByTestId('submit-admission');
        fireEvent.click(submitBtn);

        // Vérifier le message de succès (Feedback)
        expect(await screen.findByTestId('success-overlay', {}, { timeout: 10000 })).toBeInTheDocument();
        expect(screen.getByText(/Admission Validée !/i)).toBeInTheDocument();

        // Vérifier la fermeture automatique
        await waitFor(() => {
            expect(screen.queryByText(/Finaliser l'Admission/i)).not.toBeInTheDocument();
        }, { timeout: 10000 });
    }, 30000);
});
