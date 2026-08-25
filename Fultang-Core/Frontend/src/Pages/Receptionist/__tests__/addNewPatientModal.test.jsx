import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddNewPatientModal } from "../addNewPatientModal";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";

// Mock du Provider d'authentification
vi.mock("../../../Utils/Provider.jsx", () => ({
  useAuthentication: () => ({
    userData: { id: 1, nom: "Agent Test" }
  })
}));

describe("AddNewPatientModal - Tests Refinements", () => {
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

  it("devrait avoir 'Camerounaise' par défaut dans le select Nationalité", () => {
    render(<AddNewPatientModal {...defaultProps} />);
    expect(screen.getByLabelText(/Nationalité/i)).toHaveValue("Camerounaise");
  });

  it("devrait bloquer l'étape 2 si le téléphone du proche est manquant", async () => {
    const user = userEvent.setup();
    render(<AddNewPatientModal {...defaultProps} />);
    
    // Étape 1
    await user.type(screen.getByPlaceholderText(/Ex: Mvondo/i), "Dupont");
    await user.type(screen.getByPlaceholderText(/Ville ou Localité/i), "Yaoundé");
    fireEvent.change(screen.getByLabelText(/Date de Naissance/i), { target: { value: "1990-01-01" } });
    await user.click(screen.getByText(/Suivant/i));

    // Étape 2 sans téléphone
    await user.type(screen.getByPlaceholderText(/Nom du contact d'urgence/i), "Marie Proche");
    await user.selectOptions(screen.getByLabelText(/Lien de parenté/i), "PARENT");
    
    await user.click(screen.getByText(/Enregistrer le patient/i));
    
    expect(await screen.findByText(/Le numéro de téléphone est obligatoire/i)).toBeInTheDocument();
  });

  it("devrait effectuer la transition automatique vers l'étape 3 après succès", async () => {
    const user = userEvent.setup();
    render(<AddNewPatientModal {...defaultProps} />);
    
    // Étape 1
    await user.type(screen.getByPlaceholderText(/Ex: Mvondo/i), "Dupont");
    await user.type(screen.getByPlaceholderText(/Ville ou Localité/i), "Yaoundé");
    fireEvent.change(screen.getByLabelText(/Date de Naissance/i), { target: { value: "1990-01-01" } });
    await user.click(screen.getByText(/Suivant/i));

    // Étape 2
    await user.type(screen.getByPlaceholderText(/Nom du contact d'urgence/i), "Marie Proche");
    await user.selectOptions(screen.getByLabelText(/Lien de parenté/i), "PARENT");
    await user.type(screen.getByPlaceholderText(/Ex: 677XXXXXX/i), "677112233");

    await user.click(screen.getByText(/Enregistrer le patient/i));

    // Vérifie le message de succès local
    expect(await screen.findByText(/Patient enregistré !/i)).toBeInTheDocument();

    // Attendre la transition vers étape 3 (Compléments)
    await waitFor(() => {
      expect(screen.getByText(/Informations Complémentaires/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByLabelText(/Pays/i)).toHaveValue("Cameroun");
    expect(screen.getByLabelText(/Ville/i)).toHaveValue("Yaoundé");
  });
});
