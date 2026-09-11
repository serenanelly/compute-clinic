import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HospitalizedPatients } from "../HospitalizedPatients";
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

describe("Hospitalisations réception — lecture seule", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("affiche les patients hospitalisés avec service et chambre", async () => {
        render(
            <BrowserRouter>
                <HospitalizedPatients />
            </BrowserRouter>,
        );

        expect(await screen.findByTestId("page-title")).toHaveTextContent(/Hospitalisations/i);
        expect(await screen.findByText(/Kotto Paul/i)).toBeInTheDocument();
        expect(screen.getByText(/CARDIOLOGIE/i)).toBeInTheDocument();
    });

    it("n'affiche pas d'actions de finalisation", async () => {
        render(
            <BrowserRouter>
                <HospitalizedPatients />
            </BrowserRouter>,
        );

        await screen.findByText(/Kotto Paul/i);
        expect(screen.queryByText(/Finaliser/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId("finalize-btn")).not.toBeInTheDocument();
    });
});
