import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "./nurseNavLink.js";
import { NurseNavBar } from "./NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { FlaskConical, Search, Clock, FileText, AlertCircle, ChevronRight, Syringe, Stethoscope } from 'lucide-react';

const CATEGORIE_LABELS = {
    BIOLOGIE: 'Biologie',
    IMAGERIE: 'Imagerie',
    HISTOLOGIE: 'Histologie',
};

const STATUT_LABELS = {
    EN_ATTENTE: 'En attente',
    PRELEVE: 'Prélèvement effectué',
    REALISE: 'Résultats saisis',
    VALIDE: 'Validé',
};

export const NurseExams = () => {
    const [exams, setExams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            setIsLoading(true);
            const data = await nurseApi.getExams();
            setExams(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenResult = (ex) => {
        if (ex.statut === 'REALISE' || ex.statut === 'VALIDE') {
            alert('Les résultats finaux sont consultables par le médecin prescripteur.');
            return;
        }
        navigate(AppRoutesPaths.consultationHistoryPage.replace(':id', ex.patient.id || ex.patient?.id));
    };

    const filteredExams = exams.filter((ex) => {
        const term = searchTerm.toLowerCase();
        return ex.nom.toLowerCase().includes(term)
            || (ex.patient?.nom || '').toLowerCase().includes(term)
            || (ex.patient?.prenom || '').toLowerCase().includes(term);
    });

    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <FlaskConical className="w-7 h-7 mr-2 text-primary-start" />
                                Examens prescrits
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Examens demandés par le médecin — prélèvements biologiques à effectuer par l&apos;infirmier(ère) si indiqué
                            </p>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Chercher un patient ou examen…"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-start outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                        {isLoading ? <div className="flex justify-center items-center h-64"><Loading /></div> : (
                            <div className="divide-y divide-gray-100">
                                {filteredExams.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-500 font-medium">Aucun examen prescrit.</p>
                                    </div>
                                ) : (
                                    filteredExams.map((ex) => (
                                        <div key={ex.id} className="p-5 hover:bg-gray-50 transition-colors group">
                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                                                        <FileText className="w-6 h-6 text-indigo-500" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="text-lg font-bold text-gray-800">{ex.nom}</h4>
                                                            {ex.categorie && (
                                                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-wider">
                                                                    {CATEGORIE_LABELS[ex.categorie] || ex.categorie}
                                                                </span>
                                                            )}
                                                            {ex.needsPrelevement && (
                                                                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                                                    <Syringe className="w-3 h-3" />
                                                                    Prélèvement à effectuer
                                                                </span>
                                                            )}
                                                            {ex.prelevementEffectue && (
                                                                <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                                                    <Syringe className="w-3 h-3" />
                                                                    Prélèvement effectué
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
                                                            <span className="font-semibold text-gray-700">{ex.patient.nom} {ex.patient.prenom}</span>
                                                            <span className="flex items-center">
                                                                <Stethoscope className="w-3.5 h-3.5 mr-1" />
                                                                Prescrit par le médecin
                                                            </span>
                                                            {ex.date_prescription && (
                                                                <span className="flex items-center">
                                                                    <Clock className="w-3.5 h-3.5 mr-1" />
                                                                    {new Date(ex.date_prescription).toLocaleDateString('fr-FR')}
                                                                </span>
                                                            )}
                                                            {ex.motif && <span className="italic">Motif : {ex.motif}</span>}
                                                        </div>
                                                        {ex.needsPrelevement && (
                                                            <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50/80 border border-amber-100 rounded-lg px-3 py-2 inline-block">
                                                                L&apos;infirmier(ère) doit réaliser le prélèvement biologique avant envoi au laboratoire.
                                                            </p>
                                                        )}
                                                        {ex.prelevementEffectue && ex.prelevements?.[0]?.type_prelevement && (
                                                            <p className="mt-2 text-xs text-gray-500">
                                                                Type de prélèvement : {ex.prelevements[0].type_prelevement}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-gray-50 text-gray-600 border-gray-200">
                                                        {STATUT_LABELS[ex.statut] || ex.statut}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenResult(ex)}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-gray-50 text-gray-600 hover:bg-gray-100"
                                                    >
                                                        Dossier patient
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </NurseNavBar>
        </CustomDashboard>
    );
};

export default NurseExams;
