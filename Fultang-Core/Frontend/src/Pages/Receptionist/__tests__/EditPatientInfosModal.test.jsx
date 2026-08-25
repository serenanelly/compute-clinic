import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditPatientInfosModal } from "../EditPatientInfosModal";
import dayjs from "dayjs";

describe("EditPatientInfosModal - Tests", () => {
    const mockPatient = {
        id: "PAT-123",
        nom: "Mvondo",
        prenom: "Jean",
        sexe: "MASCULIN",
        date_naissance: "1990-05-15",
        profession: "Ingénieur",
        contact: "677112233",
        ville: "Yaoundé",
        nom_proche: "Mvondo Marie",
        contact_proche: "699887766"
    };

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        setCanOpenSuccessModal: vi.fn(),
        setSuccessMessage: vi.fn(),
        setIsLoading: vi.fn(),
        patientData: mockPatient,
        onUpdateSuccess: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("devrait pré-remplir les champs avec les données du patient", () => {
        render(<EditPatientInfosModal {...defaultProps} />);
        
        expect(screen.getByDisplayValue("Mvondo")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Jean")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Ingénieur")).toBeInTheDocument();
        expect(screen.getByDisplayValue("677112233")).toBeInTheDocument();
    });

    it("devrait afficher une erreur si le nom est vidé", async () => {
        const user = userEvent.setup();
        render(<EditPatientInfosModal {...defaultProps} />);
        
        const nomInput = screen.getByDisplayValue("Mvondo");
        await user.clear(nomInput);
        
        await user.click(screen.getByText(/Enregistrer les modifications/i));
        
        expect(await screen.findByText(/Le nom est obligatoire/i)).toBeInTheDocument();
    });

    it("devrait appeler l'API et onUpdateSuccess lors d'une modification réussie", async () => {
        const user = userEvent.setup();
        render(<EditPatientInfosModal {...defaultProps} />);
        
        const professionInput = screen.getByDisplayValue("Ingénieur");
        await user.clear(professionInput);
        await user.type(professionInput, "Médecin");
        
        await user.click(screen.getByText(/Enregistrer les modifications/i));
        
        await waitFor(() => {
            expect(defaultProps.setSuccessMessage).toHaveBeenCalledWith(expect.stringContaining("mis à jour"));
            expect(defaultProps.onUpdateSuccess).toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });
});
