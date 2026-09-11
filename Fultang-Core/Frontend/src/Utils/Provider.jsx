import constate from "constate";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getGatewayBaseUrl } from "./gatewayUrls";

export const [FultangProvider, useAuthentication] = constate(
  useLogin,
  (value) => value.authMethods
);

import { getValidToken } from "./setupAuthRefresh.js";

function loadAuthFromStorage() {
  try {
    const token = getValidToken();
    if (!token) {
      return { isLogged: false, userData: {}, userRole: "" };
    }
    const savedUserData = localStorage.getItem("user_data_fultang");
    const savedUserRole = localStorage.getItem("user_role_fultang");
    if (savedUserData && savedUserRole) {
      return {
        isLogged: true,
        userData: JSON.parse(savedUserData),
        userRole: savedUserRole,
      };
    }
  } catch (error) {
    console.error("Erreur lecture auth localStorage:", error);
  }
  return { isLogged: false, userData: {}, userRole: "" };
}

function useLogin() {
  const initialAuth = loadAuthFromStorage();
  const [isLogged, setIsLogged] = useState(initialAuth.isLogged);
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(initialAuth.userData);
  const [userRole, setUserRole] = useState(initialAuth.userRole);

  function saveAuthParameters(token, refreshToken) {
    localStorage.setItem("token_key_fultang", token);
    localStorage.setItem("refresh_token_fultang", refreshToken);
  }

  function saveUserData(user, effectiveRole) {
    localStorage.setItem("user_data_fultang", JSON.stringify(user));
    localStorage.setItem("user_role_fultang", effectiveRole);
    // Stocker personnel_id et user_name pour les composants qui en ont besoin
    if (user.idpersonnel || user.id) {
      localStorage.setItem("personnel_id", String(user.idpersonnel || user.id));
    }
    if (user.nom || user.prenom) {
      localStorage.setItem("user_name", `${user.prenom || ''} ${user.nom || ''}`.trim());
    }
  }

  function clearLocalStorage() {
    localStorage.removeItem("token_key_fultang");
    localStorage.removeItem("refresh_token_fultang");
    localStorage.removeItem("user_data_fultang");
    localStorage.removeItem("user_role_fultang");
    // Nettoyer également personnel_id et user_name
    localStorage.removeItem("personnel_id");
    localStorage.removeItem("user_name");
  }

  async function login(data) {
    try {
      const gatewayURL = getGatewayBaseUrl();
      console.log('=== TENTATIVE DE CONNEXION (Gateway) ===');
      console.log('URL Gateway:', gatewayURL);
      console.log('Données envoyées:', { email: data.email, password: '***' });

      const response = await axios.post(
        `${gatewayURL}/auth/login`,
        { email: data.email, password: data.password }
      );

      console.log('=== RÉPONSE DE LA GATEWAY ===');
      console.log('Status:', response.status);
      console.log('Réponse complète:', response.data);

      if (response.status === 200 && response.data.access_token) {
        setIsLoading(false);

        // Sauvegarder les tokens JWT de la Gateway
        saveAuthParameters(response.data.access_token, response.data.refresh_token);

        // Récupérer les données utilisateur de la réponse Gateway
        const gatewayUser = response.data.user;
        // Les rôles viennent sous forme de tableau ["Admin"], ["Medecin"], etc.
        const roles = gatewayUser.roles || [];
        const primaryRole = roles[0] || '';

        // Mapper le rôle du modèle Django vers le rôle de navigation
        const ROLE_MAP = {
          'Admin': 'admin',
          'Medecin': 'medecin',
          'MedecinGeneraliste': 'medecin',
          'MedecinSpecialiste': 'specialist',
          'Infirmiere': 'infirmier',
          'Receptionniste': 'receptioniste',
          'ComptableFinancier': 'comptable_financier',
          'ComptableMatiere': 'compta_matiere',
          'Caissier': 'caissier',
          'Laborantin': 'laborantin',
          'Pharmacien': 'pharmacien',
          'Directeur': 'directeur',
        };

        // Override par email : Paul = caissier, Njoya = comptabilité financière
        const EMAIL_ROLE_OVERRIDE = {
          'paul.talla@fultang.local': 'caissier',
          'i.njoya@fultang.local': 'comptable_financier',
        };

        const mappedRole = ROLE_MAP[primaryRole] || primaryRole.toLowerCase();
        const email = (gatewayUser.email || data.email || '').toLowerCase();
        const effectiveRole = EMAIL_ROLE_OVERRIDE[email] || mappedRole;

        console.log('=== DÉTERMINATION DU RÔLE ===');
        console.log('Rôles Gateway:', roles);
        console.log('Rôle primaire:', primaryRole);
        console.log('Email utilisé:', email);
        console.log('Rôle effectif:', effectiveRole);

        // Construire un objet user compatible avec le reste du frontend
        const user = {
          id: gatewayUser.id,
          idpersonnel: gatewayUser.id,
          nom: gatewayUser.nom || '',
          prenom: gatewayUser.prenom || '',
          email: gatewayUser.email,
          role: 'personnel',
          poste: effectiveRole,
        };

        setUserData(user);
        setUserRole(effectiveRole);
        setIsLogged(true);
        saveUserData(user, effectiveRole);

        console.log('=== CONNEXION RÉUSSIE ===');

        return {
          success: true,
          role: effectiveRole,
          message: 'Connexion réussie',
          first_login_done: true  // La Gateway ne fournit pas ce champ, on suppose true
        };
      }
    } catch (error) {
      setIsLoading(false);
      console.error("=== ERREUR D'AUTHENTIFICATION ===");
      console.error("Error object:", error);

      if (error.response) {
        console.error('Réponse erreur du serveur:', error.response.data);
        console.error('Status:', error.response.status);
        return {
          success: false,
          status: error.response.status,
          error: error.response.data.error || "Erreur d'authentification",
          detail: error.response.data.detail || "Identifiants invalides"
        };
      } else if (error.request) {
        console.error('Pas de réponse du serveur');
        return {
          success: false,
          error: "Erreur de connexion",
          detail: "Impossible de contacter le serveur. Vérifiez que la Gateway et le backend sont démarrés."
        };
      } else {
        console.error('Erreur de configuration:', error.message);
        return {
          success: false,
          error: "Erreur",
          detail: error.message
        };
      }
    }
  }

  async function loginPlatformAdmin(data) {
    // Identité distincte du personnel d'un tenant (voir login() ci-dessus) :
    // endpoint Gateway dédié, jamais de tenant_id, rôle "platform_admin"
    // uniquement si le backend (tenant-service) le confirme — jamais
    // déduit ou fourni par ce frontend.
    try {
      const gatewayURL = getGatewayBaseUrl();
      const response = await axios.post(
        `${gatewayURL}/auth/platform-admin/login`,
        { email: data.email, password: data.password }
      );

      if (response.status === 200 && response.data.access_token) {
        setIsLoading(false);
        saveAuthParameters(response.data.access_token, response.data.refresh_token);

        const admin = response.data.user;
        const roles = admin.roles || [];

        if (!roles.includes('PLATFORM_ADMIN')) {
          // Ne devrait jamais arriver (le backend ne renvoie ce rôle que
          // pour un compte PlatformAdmin valide) — refus par prudence.
          return { success: false, error: "Accès refusé", detail: "Ce compte n'a pas le rôle Platform Admin." };
        }

        const user = {
          id: admin.id,
          idpersonnel: admin.id,
          nom: admin.nom || '',
          prenom: admin.prenom || '',
          email: admin.email,
          role: 'platform_admin',
          poste: 'platform_admin',
        };

        setUserData(user);
        setUserRole('platform_admin');
        setIsLogged(true);
        saveUserData(user, 'platform_admin');

        return { success: true, role: 'platform_admin', message: 'Connexion réussie' };
      }
    } catch (error) {
      setIsLoading(false);
      if (error.response) {
        return {
          success: false,
          status: error.response.status,
          error: error.response.data.error || "Erreur d'authentification",
          detail: error.response.data.detail || "Identifiants invalides"
        };
      } else if (error.request) {
        return {
          success: false,
          error: "Erreur de connexion",
          detail: "Impossible de contacter le serveur. Vérifiez que la Gateway et le backend sont démarrés."
        };
      }
      return { success: false, error: "Erreur", detail: error.message };
    }
  }

  async function getCurrentUserInfos() {
    const token = localStorage.getItem("token_key_fultang");
    if (token) {
      try {
        // Remarque : aucun endpoint /me/ n'existe côté backend (aucune
        // route ne le sert dans aucun service) et cette fonction n'est
        // appelée nulle part dans le frontend — code mort, non exécuté en
        // pratique. On corrige tout de même sa résolution d'URL pour
        // rester cohérent avec les autres appels (getGatewayBaseUrl()
        // cible le hostname courant / tenant réellement ouvert).
        const response = await axios.get(
          `${getGatewayBaseUrl()}/medical/me/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.status === 200) {
          console.log(response.data);
          setIsLogged(true);
          setUserData(response.data);
          setUserRole(response.data.role);
        }
      } catch (error) {
        console.log(error);
        setIsLogged(false);
      }
    }
  }

  useEffect(() => {
    const restored = loadAuthFromStorage();
    if (restored.isLogged) {
      setUserData(restored.userData);
      setUserRole(restored.userRole);
      setIsLogged(true);
      return;
    }

    const token = localStorage.getItem("token_key_fultang");
    if (token) {
      clearLocalStorage();
    }
    setIsLogged(false);
    setUserData({});
    setUserRole("");
  }, []);

  function isAuthenticated() {
    if (isLogged) return true;
    return !!(
      localStorage.getItem("token_key_fultang") &&
      localStorage.getItem("user_data_fultang") &&
      localStorage.getItem("user_role_fultang")
    );
  }

  function hasRole(requiredRole) {
    const wanted = requiredRole.toLowerCase();
    const matchesRole = (role) => {
      if (!role) return false;
      const normalized = role.toLowerCase();
      if (normalized === wanted) return true;

      // Groupes de rôles équivalents (Bilinguisme Anglais/Français & alias)
      const groups = [
        ['receptionist', 'receptioniste', 'receptionniste'],
        ['nurse', 'infirmier', 'infirmiere'],
        ['doctor', 'medecin', 'medecingeneraliste', 'medecinspecialiste', 'specialist'],
        ['pharmacist', 'pharmacien'],
        ['director', 'directeur'],
        ['laborantin', 'laboratory', 'laboratoryassistant', 'laboratory-assistant'],
        ['comptable_financier', 'comptable', 'accountant'],
        ['compta_matiere', 'material_accountant'],
        ['admin', 'administrateur', 'administrateur_systeme', 'administrator'],
        ['platform_admin', 'platformadmin'],
      ];

      for (const group of groups) {
        if (group.includes(wanted) && group.includes(normalized)) {
          return true;
        }
      }
      return false;
    };

    if (matchesRole(userRole)) return true;

    if (userData?.role) {
      const effectiveRole = userData.role === "personnel" ? userData.poste : userData.role;
      if (matchesRole(effectiveRole)) return true;
    }

    const storedRole = localStorage.getItem("user_role_fultang");
    if (isAuthenticated() && matchesRole(storedRole)) return true;

    return false;
  }

  function logout() {
    clearLocalStorage();
    setIsLogged(false);
    setUserData({});
    setUserRole("");
    window.location.href = "/login";
  }

  const authMethods = useMemo(
    () => ({
      login,
      loginPlatformAdmin,
      setIsLoading,
      isLoading,
      userData,
      isLogged,
      isAuthenticated,
      hasRole,
      userRole,
      logout,
    }),
    [isLoading, userData, isLogged, userRole, logout]
  );
  return { authMethods };
}
