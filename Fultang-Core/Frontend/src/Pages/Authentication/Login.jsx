import loginBackground from "../../assets/logIn.png";
import { FaExclamation } from "react-icons/fa";
import { Link, useNavigate } from 'react-router-dom';
import { useState } from "react";
import Wait from "../Modals/wait.jsx";
import { Eye, EyeOff } from 'lucide-react';
import { AppRoutesPaths as appRouterPaths } from "../../Router/appRouterPaths.js";
import { useAuthentication } from "../../Utils/Provider.jsx";
import { ChangePasswordModal } from "../../GlobalComponents/ChangePasswordModal.jsx";




export function LoginPage() {


    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isLoginErrorPresent, setIsLoginErrorPresent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [pendingRole, setPendingRole] = useState(null);
    const { isLoading, setIsLoading, login, userData } = useAuthentication();
    const navigate = useNavigate();



    const data = {
        email: username,
        password: password
    }



    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const response = await login(data);
        console.log(response);

        // Verifier si la connexion a reussi
        if (response && response.success) {
            setIsLoginErrorPresent(false);
            setLoginError("");

            const role = response.role?.toLowerCase();

            // Verifier si c'est la premiere connexion (sauf pour admin)
            if (role !== 'admin' && response.first_login_done === false) {
                setPendingRole(role);
                setShowPasswordModal(true);
                setIsLoading(false);
                return;
            }

            // Redirection selon le role/poste
            navigateToRole(role);
        } else {
            // Afficher l'erreur
            setIsLoginErrorPresent(true);
            if (response && response.error) {
                setLoginError(`${response.error}: ${response.detail}`);
            } else {
                setLoginError("Une erreur inconnue s'est produite");
            }
        }

        setIsLoading(false);
    }

    const navigateToRole = (role) => {
        switch (role) {
            case 'admin':
                navigate(appRouterPaths.adminHomePage);
                break;
            case 'receptioniste':
                navigate(appRouterPaths.receptionistPage);
                break;
            case 'infirmier':
                navigate(appRouterPaths.nursePage);
                break;
            case 'medecin':
                navigate(appRouterPaths.doctorPage);
                break;
            case 'specialist':
                navigate(appRouterPaths.specialistPage);
                break;
            case 'caissier':
                navigate(appRouterPaths.cashierPage);
                break;
            case 'comptable_financier':
            case 'comptable':
                navigate(appRouterPaths.accountantHome);
                break;
            case 'compta_matiere':
                navigate(appRouterPaths.comptaMatiereDashboard);
                break;
            case 'laborantin':
                navigate(appRouterPaths.laboratoryAssistantPage);
                break;
            case 'pharmacien':
                navigate(appRouterPaths.pharmacistPrescriptions);
                break;
            case 'directeur':
                navigate(appRouterPaths.directorDashboard);
                break;
            default:
                console.warn('Role non reconnu:', role);
                alert(`Connexion réussie mais redirection non configurée pour le rôle: ${role}`);
        }
    }

    const handlePasswordChangeSuccess = () => {
        setShowPasswordModal(false);
        // Rediriger vers la page appropriee apres changement de mot de passe
        if (pendingRole) {
            navigateToRole(pendingRole);
        }
    }




    return (
        <>
            <div className="flex flex-col"
                style={{
                    backgroundImage: `url(${loginBackground})`,
                    height: "100vh",
                    backgroundSize: "cover",
                    backgroundRepeat: "no-repeat",
                }}
            >
                <p onClick={() => navigate("/")} className="text-3xl text-white font-bold mt-6 ml-8 cursor-pointer">
                    FullTang
                </p>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="flex ml-56 mt-28 w-[1400px] h-[480px]">
                        <div className="flex flex-col w-[620px]">
                            <p className="text-white mt-28 mb-2 font-bold text-5xl ml-4">
                                WELCOME ON FULTANG
                            </p>
                            <p className="text-justify font-bold text-md leading-10">
                                Polyclinic fultang is a hospital management application, providing care and monitoring of patients from arrival to discharge,
                                this via the platform. We first register the patient at the reception level, then follow the chain of follow-up according to his problem or his situation.
                                Polyclinic Fultang has several departments namely the dental service, the ophthalmology service, the general medicine, the laboratory,
                                as well as a pharmacy.
                            </p>
                            <p className="italic mt-4 text-blue-400 text-xl ">
                                Note: this page is the hospital staff login page
                            </p>
                            <button onClick={() => navigate(appRouterPaths.helpCenterPage)} className="w-44 h-14  py-2 border-secondary border-2 text-secondary rounded-lg px-1 mt-4 font-bold hover:text-white hover:bg-secondary transition-all duration-300">
                                <div className="flex justify-center items-center">
                                    <FaExclamation className="mr-1 " />
                                    <p>Notify A problem</p>
                                </div>
                            </button>
                        </div>
                        <div className="bg-white shadow-2xl border-2 w-[550px] mt-6 ml-16 flex flex-col rounded-lg">
                            <div className="flex mb-10">
                                <p className="text-3xl font-bold mt-4 ml-4  ">Log In</p>
                                {isLoginErrorPresent && (
                                    <p className="text-red-500 text-md font-bold mt-6 ml-8 mr-2">{loginError}</p>)}

                            </div>
                            <form className="ml-4 mr-8 flex flex-col" onSubmit={handleLogin}>
                                <div>
                                    <label className="text-md font-bold">
                                        username
                                    </label>
                                    <div className="bg-gray-300 h-12 mt-2 rounded-lg mb-4">
                                        <input type="text"
                                            name="username"
                                            autoComplete="username"
                                            onChange={(e) => { setUsername(e.target.value) }}
                                            className="w-full rounded-lg h-12 ml-2 mr-2 bg-gray-300 border-none outline:none focus:border-none ring-0 focus:outline-none focus:ring-0 autofill:shadow-[inset_0_0_0px_1000px_rgb(209,213,219)]"
                                            placeholder={"Enter your username here"} />
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <label className="text-md font-bold">
                                        Password
                                    </label>
                                    <div className="bg-gray-300 h-12 mt-2 rounded-lg flex items-center relative">
                                        <input
                                            name="password"
                                            autoComplete="current-password"
                                            type={showPassword ? "text" : "password"}
                                            onChange={(e) => { setPassword(e.target.value) }}
                                            className="w-full rounded-lg h-12 ml-2 mr-10 bg-gray-300 border-none outline:none ring-0 focus:outline-none focus:ring-0"
                                            placeholder="Enter your password here"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 p-2 hover:bg-gray-400 rounded-full transition-all duration-300"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-5 h-5 text-gray-600" />
                                            ) : (
                                                <Eye className="w-5 h-5 text-gray-600" />
                                            )}
                                        </button>
                                    </div>
                                    <Link to={appRouterPaths.forgottenPasswordPage}>
                                        <p className="text-end mt-1 text-sm text-blue-700 hover:text-secondary hover:font-bold transition-all duration-300 hover:underline">
                                            Forgotten password?
                                        </p>
                                    </Link>
                                </div>

                                {/*  <div className="flex mt-5">
                                    <input type="checkbox" id="rememberMeCheckbox" value="yes"
                                           className="mr-2 w-5 h-5 border-secondary border-2"/>
                                    <label htmlFor="maCheckbox" className="font-bold text-sm">Remember Me</label>
                                </div>*/}

                                <button type="submit"
                                    className="text-white text-2xl bg-gradient-to-r from-primary-start to-primary-end w-full h-12 rounded-lg mt-5 mb-5 font-bold">
                                    Log In
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            </div>
            {isLoading && (<Wait />)}

            {/* Modal de changement de mot de passe pour premiere connexion */}
            <ChangePasswordModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                isFirstLogin={true}
                onSuccess={handlePasswordChangeSuccess}
            />
        </>
    )
}