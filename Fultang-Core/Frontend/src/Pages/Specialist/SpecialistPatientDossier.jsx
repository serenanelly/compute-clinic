import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import {
    FolderOpen, ArrowLeft, Calendar, FileText, Pill,
    FlaskConical, Stethoscope, AlertTriangle, AlertCircle, History, Microscope
} from 'lucide-react';

export const SpecialistPatientDossier = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [patientData, setPatientData] = useState(null);
    const [visites, setVisites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchAll = async () => {
            try {
                setIsLoading(true);
                const [dossier, patientVisites] = await Promise.all([
                    doctorApi.getPatientDossier(id),
                    doctorApi.getPatientVisites(id)
                ]);
                setPatientData(dossier);
                setVisites(patientVisites);
            } catch (err) {
                console.error("Erreur chargement dossier spécialiste", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAll();
    }, [id]);

    const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (isLoading) {
        return (
            <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
                <div className="flex justify-center items-center h-full"><Loading /></div>
            </CustomDashboard>
        );
    }

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50 overflow-hidden">

                {/* Top Bar */}
                <div className="flex items-center mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 mr-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <Microscope className="w-6 h-6 mr-2 text-purple-600" />
                            Dossier Médical — Vue Spécialiste
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Lecture complète avant consultation spécialisée</p>
                    </div>
                </div>

                <div className="flex gap-6 flex-1 overflow-hidden">

                    {/* Left: Identité + Antécédents */}
                    <div className="w-1/3 flex flex-col gap-5 overflow-y-auto scrollbar pb-6">

                        {/* Profile */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
                            <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-2xl mb-4 border-4 border-white shadow-sm">
                                {patientData?.nom?.charAt(0)}{patientData?.prenom?.charAt(0)}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">{patientData?.nom} {patientData?.prenom}</h3>
                            <p className="text-gray-500 font-mono text-sm mt-1">ID: {patientData?.matricule || patientData?.id?.substring(0, 8)}</p>

                            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Âge</p>
                                    <p className="font-semibold text-gray-700">{patientData?.age ? `${patientData.age} ans` : 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Sexe</p>
                                    <p className="font-semibold text-gray-700">{patientData?.sexe || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Groupe Sanguin</p>
                                    <p className="font-semibold text-gray-700">{patientData?.donnees_cliniques?.groupe_sanguin || 'Non spécifié'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Facteur Rhésus</p>
                                    <p className="font-semibold text-gray-700">{patientData?.donnees_cliniques?.facteur_rhesus || 'Non spécifié'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Antécédents & Allergies */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
                                Antécédents & Allergies
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Allergies connues</p>
                                    <div className="flex flex-wrap gap-2">
                                        {patientData?.allergies?.length > 0
                                            ? patientData.allergies.map((a, i) => (
                                                <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100">
                                                    {a.declencheur}
                                                </span>
                                            ))
                                            : <span className="text-sm text-gray-400 italic">Aucune allergie connue</span>
                                        }
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Maladies chroniques</p>
                                    <div className="flex flex-wrap gap-2">
                                        {patientData?.maladies?.length > 0
                                            ? patientData.maladies.map((m, i) => (
                                                <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-100">
                                                    {m.nom}
                                                </span>
                                            ))
                                            : <span className="text-sm text-gray-400 italic">Aucune maladie signalée</span>
                                        }
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Antécédents médicaux</p>
                                    <ul className="text-sm text-gray-600 space-y-1">
                                        {patientData?.antecedents?.length > 0
                                            ? patientData.antecedents.map((a, i) => <li key={i}>• {a.nom || a.description}</li>)
                                            : <li className="italic text-gray-400">Aucun antécédent</li>
                                        }
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Bouton Consulter */}
                        <button
                            onClick={() => navigate(`/specialist/consultation?patient=${id}`)}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            <Stethoscope className="w-5 h-5" />
                            Démarrer la consultation spécialisée
                        </button>
                    </div>

                    {/* Right: Historique des visites */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-gray-100">
                            <h4 className="font-bold text-gray-800 text-lg flex items-center">
                                <History className="w-5 h-5 mr-2 text-purple-600" />
                                Historique complet des visites & consultations
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">Toutes les consultations précédentes (généraliste + spécialiste)</p>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 scrollbar bg-gray-50/50">
                            {visites.length === 0 ? (
                                <div className="text-center p-12 text-gray-400">
                                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Aucune visite enregistrée pour ce patient.</p>
                                </div>
                            ) : (
                                <div className="space-y-5 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-purple-200 before:to-transparent">
                                    {visites.map((visite) => (
                                        <div key={visite.id} className="relative flex items-start gap-4 group">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-purple-200 bg-white text-purple-600 shadow shrink-0 z-10">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-gray-800 text-sm">{formatDate(visite.date_heure)}</span>
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${visite.statut === 'EN_COURS' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                        {visite.statut}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 italic mb-3">"{visite.motif_visite}"</p>

                                                {visite.consultations?.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {visite.consultations.map((c, ci) => (
                                                            <div key={ci} className="border-t pt-2">
                                                                {c.diagnostics?.length > 0 && (
                                                                    <div className="mb-1">
                                                                        <p className="text-xs font-bold text-gray-400 flex items-center mb-1">
                                                                            <Stethoscope className="w-3 h-3 mr-1" /> Diagnostics
                                                                        </p>
                                                                        <ul className="text-sm text-gray-700 pl-3 list-disc marker:text-purple-400">
                                                                            {c.diagnostics.map((d, i) => <li key={i}>{d.libelle}</li>)}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {c.prescriptions?.length > 0 && (
                                                                    <div className="mb-1">
                                                                        <p className="text-xs font-bold text-gray-400 flex items-center mb-1">
                                                                            <Pill className="w-3 h-3 mr-1" /> Médicaments prescrits
                                                                        </p>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {c.prescriptions.map((p, i) => (
                                                                                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                                                                    {p.nom || p.medicament}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                    {c.examens?.length > 0 && (
                                                                        <div className="mt-2">
                                                                            <p className="text-xs font-bold text-gray-400 flex items-center mb-1"><FlaskConical className="w-3 h-3 mr-1"/> Examens prescrits</p>
                                                                            <div className="flex flex-col gap-2">
                                                                                {c.examens.map((e, i) => (
                                                                                    <div key={i} className="bg-purple-50 p-2 rounded border border-purple-100">
                                                                                        <p className="text-sm font-bold text-purple-800">
                                                                                            {e.nom || e.nom_examen || "Examen sans nom"} 
                                                                                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${e.statut === 'REALISE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                                                {e.statut === 'REALISE' ? 'Réalisé' : 'En attente'}
                                                                                            </span>
                                                                                        </p>
                                                                                        {e.statut === 'REALISE' && e.resultat && (
                                                                                            <div className="mt-2 text-xs bg-white p-2 rounded border border-purple-100">
                                                                                                <p className="font-bold text-gray-700">Résultats :</p>
                                                                                                <p className="text-gray-600 mb-1">{e.resultat.resultats}</p>
                                                                                                {e.resultat.interpretation && (
                                                                                                    <>
                                                                                                        <p className="font-bold text-gray-700 mt-1">Interprétation :</p>
                                                                                                        <p className="text-gray-600">{e.resultat.interpretation}</p>
                                                                                                    </>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-400 flex items-center">
                                                        <AlertCircle className="w-3 h-3 mr-1" /> Aucune consultation détaillée.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </CustomDashboard>
    );
};

export default SpecialistPatientDossier;
