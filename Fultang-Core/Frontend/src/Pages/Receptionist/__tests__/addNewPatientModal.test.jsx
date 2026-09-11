import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddNewPatientModal } from "../addNewPatientModal";

vi.mock("../../../Utils/Provider.jsx", () => ({
  useAuthentication: () => ({
    userData: { id: 1, nom: "Agent Test" },
  }),
}));

vi.mock("../../../services/patientRegistrationApi.js", () => ({
  createPatientWithDetails: vi.fn().mockResolvedValue({
    id: "uuid-1",
    nom: "Dupont",
    matricule: "26F0001",
  }),
}));

import { createPatientWithDetails } from "../../../services/patientRegistrationApi.js";

describe("AddNewPatientModal — formulaire simplifié réception", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    setCanOpenSuccessModal: vi.fn(),
    setSuccessMessage: vi.fn(),
    setIsLoading: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le formulaire identité en une seule étape", () => {
    render(<AddNewPatientModal {...defaultProps} />);
    expect(screen.getByLabelText(/^Nom/i)).toBeInTheDocument();
    expect(screen.getByText(/Téléphone du patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Personne à prévenir/i)).toBeInTheDocument();
    expect(screen.queryByText(/Photo du Patient/i)).not.toBeInTheDocument();
  });

  it("mode code identifiant : un seul champ obligatoire", async () => {
    const user = userEvent.setup();
    render(<AddNewPatientModal {...defaultProps} />);

    await user.click(screen.getByText(/Code identifiant/i));
    await user.type(screen.getByPlaceholderText(/URG-042/i), "BRACELET-99");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => {
      expect(createPatientWithDetails).toHaveBeenCalledWith(
        expect.objectContaining({ code_identifiant: "BRACELET-99" }),
        "code",
      );
    });
  });

  it("mode identité : exige le nom et la profession", async () => {
    const user = userEvent.setup();
    render(<AddNewPatientModal {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    expect(await screen.findByText(/Le nom est obligatoire/i)).toBeInTheDocument();
    expect(screen.getByText(/La profession est obligatoire/i)).toBeInTheDocument();
  });

  it("mode identité : profession Autre exige la précision", async () => {
    const user = userEvent.setup();
    render(<AddNewPatientModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText(/Nom de famille/i), "Mbarga");
    await user.selectOptions(screen.getByLabelText(/^Profession/i), "AUTRE");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    expect(await screen.findByText(/Précisez la profession/i)).toBeInTheDocument();
  });
});
