import { cashierNavLink } from "./cashierNavLink.js";
import { useAuthentication } from "../../Utils/Provider.jsx";
import PatientsList from "./PatientsList.jsx";
import { useEffect, useState, useCallback } from "react";
import { getPatientsEnAttente } from "../../services/caissierApi.js";
import { useAutoRefresh, deepEqual } from "../../hooks/usePolling";
import { getToken } from "../../Utils/authToken.js";
import { CashierLayout } from "./components/CashierLayout.jsx";
import { RefreshCw } from "lucide-react";
import { Button } from "antd";
import userIcon from "../../assets/userIcon.png";

export function Cashier() {
  const { userData } = useAuthentication();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  const fetchPatients = useCallback(async (page = 1, isBackground = false) => {
    if (!getToken()) {
      setAuthError(true);
      if (!isBackground) setIsLoading(false);
      return;
    }
    if (!isBackground) setIsLoading(true);
    try {
      const response = await getPatientsEnAttente();
      setAuthError(false);
      if (!isBackground) setIsLoading(false);
      if (response.success) {
        const newData = response.data || [];
        setPatients(prev => deepEqual(prev, newData) ? prev : newData);
      }
    } catch (error) {
      if (!isBackground) setIsLoading(false);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setAuthError(true);
      }
      console.error('Error loading patients:', error);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useAutoRefresh(() => fetchPatients(1, true), 5000, false);

  const userName = userData?.prenom
    ? `${userData.prenom} ${userData.nom || ''}`.trim()
    : (userData?.nom || 'Caissier');

  const patientsAvecImpayes = patients.filter(
    (p) => Number(p.montant_restant_total ?? p.montant_restant ?? 0) > 0
  );

  return (
    <CashierLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 border-l-primary-end">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={userIcon}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full border-2 border-primary-end/30 object-cover ring-2 ring-primary-end/10"
          />
          <div className="min-w-0">
            <p className="text-sm text-slate-500 m-0">Bonjour,</p>
            <p className="text-xl font-bold text-slate-900 m-0">{userName}</p>
            <p className="text-sm text-slate-600 mt-1 m-0">
              {patientsAvecImpayes.length > 0 ? (
                <>
                  <strong>{patientsAvecImpayes.length}</strong> patient{patientsAvecImpayes.length !== 1 ? 's' : ''} avec impayé{patientsAvecImpayes.length !== 1 ? 's' : ''} détecté{patientsAvecImpayes.length !== 1 ? 's' : ''}
                </>
              ) : (
                <>Aucun impayé en attente — recherchez un patient au guichet ci-dessous</>
              )}
            </p>
            <p className="text-sm text-slate-500 mt-2 m-0 max-w-xl">
              Recherchez un patient par nom ou matricule pour enregistrer une quittance au guichet.
            </p>
          </div>
        </div>
        <Button
          icon={<RefreshCw size={14} />}
          onClick={() => fetchPatients(1, false)}
          loading={isLoading}
          className="shrink-0"
        >
          Actualiser
        </Button>
      </div>

      {authError && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          Session expirée ou non connecté.{' '}
          <a href="/login" className="font-semibold underline">
            Reconnectez-vous
          </a>{' '}
          pour charger les patients.
        </div>
      )}

      <PatientsList
        patientsList={patients}
        onRefresh={() => fetchPatients(1, false)}
      />
    </CashierLayout>
  );
}
