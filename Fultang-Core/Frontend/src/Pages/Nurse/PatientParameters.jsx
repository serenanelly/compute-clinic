import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { nurseNavLink } from "./nurseNavLink.js";
import { NurseNavBar } from "./NurseNavBar.jsx";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { nurseApi } from "../../services/nurseApi.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import ConfirmSaveParameters from "./ConfirmSaveParameters.jsx";
import NursePatientAdminSection, { dossierToAdminForm } from "./NursePatientAdminSection.jsx";
import { ArrowLeft, ActivitySquare, FlaskConical } from 'lucide-react';

export const PatientParameters = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const visiteId = searchParams.get('visite');

    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Form state matching Django Model fields
    const [adminForm, setAdminForm] = useState({
        nom: '', prenom: '', sexe: 'MASCULIN', date_naissance: '', lieu_naissance: '',
        code_identifiant: '', est_anonyme: false, num_securite_sociale: '',
        profession: '', nationalite: 'Camerounaise', statut_matrimonial: 'CELIBATAIRE',
        nombre_enfants: 0, pays: 'Cameroun', ville: '', quartier: '', rue: '',
        nom_proche: '', contact_proche: '', contact: '',
    });

    const [parameters, setParameters] = useState({
        groupe_sanguin: '',
        facteur_rhesus: '',
        electrophorese_hb: '',
        poids: '',
        taille: '',
        pouls: '',
        taux_oxygene: '',
        temperature: '',
        tension_arterielle: '',
        frequence_respiratoire: '',
        glycemie: '',
        allergie_declencheur: '',
        allergie_manifestation: '',
        a_des_allergies: 'non',
        a_des_antecedents: 'non',
        antecedent_medical_nom: '',
        antecedent_medical_date: '',
        antecedent_medical_description: '',
        antecedent_familial_nom: '',
        antecedent_familial_date: '',
        antecedent_familial_description: '',
    });

    useEffect(() => {
        fetchPatientDetails();
    }, [id]);

    const fetchPatientDetails = async () => {
        try {
            setIsLoading(true);
            const data = await nurseApi.getPatientDetails(id);
            setPatient(data);
            
            const dc = data.donnees_cliniques || {};
            
            setAdminForm(dossierToAdminForm(data));

            setParameters({
                groupe_sanguin: dc.groupe_sanguin || '',
                facteur_rhesus: dc.facteur_rhesus || '',
                electrophorese_hb: dc.electrophorese_hb || '',
                poids: dc.poids || '',
                taille: dc.taille || '',
                pouls: dc.pouls || '',
                taux_oxygene: dc.taux_oxygene || '',
                temperature: dc.temperature || '',
                tension_arterielle: dc.tension_arterielle || '',
                frequence_respiratoire: dc.frequence_respiratoire || '',
                glycemie: dc.glycemie || '',
                allergie_declencheur: data.allergies?.[0]?.declencheur || '',
                allergie_manifestation: data.allergies?.[0]?.manifestation || '',
                a_des_allergies: data.allergies?.length ? 'oui' : 'non',
                a_des_antecedents: data.antecedents?.length ? 'oui' : 'non',
                antecedent_medical_nom: '',
                antecedent_medical_date: '',
                antecedent_medical_description: '',
                antecedent_familial_nom: '',
                antecedent_familial_date: '',
                antecedent_familial_description: '',
            });
        } catch (err) {
            setError("Impossible de charger les informations du patient.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setParameters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setError('');
        setIsConfirmModalOpen(true);
    };

    const handleConfirmSave = async () => {
        try {
            setIsSaving(true);
            setError('');
            await nurseApi.savePatientParameters(id, { ...parameters, visiteId });
            setIsConfirmModalOpen(false);
            navigate(AppRoutesPaths.nurseWaitingRoomPage);
        } catch (err) {
            setIsConfirmModalOpen(false);
            setError(err.message || "Une erreur est survenue lors de l'enregistrement.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
                <NurseNavBar>
                    <div className="flex-1 flex justify-center items-center h-[calc(100vh-100px)]">
                        <Loading />
                    </div>
                </NurseNavBar>
            </CustomDashboard>
        );
    }

    if (!patient) return null;

    const traitementsEnCours = (patient.maladies || []).flatMap((m) =>
        (m.traitements || []).map((t) => ({ ...t, maladie: m.nom }))
    );

    return (
        <CustomDashboard linkList={nurseNavLink} requiredRole="nurse">
            <NurseNavBar>
                <div className="p-6 h-[calc(100vh-100px)] flex flex-col bg-gray-50/50 overflow-y-auto scrollbar">
                    
                    <div className="flex items-center mb-6">
                        <button 
                            onClick={() => navigate(AppRoutesPaths.nurseWaitingRoomPage)}
                            className="mr-4 p-2 bg-white text-gray-500 rounded-full hover:bg-gray-100 transition-colors shadow-sm border border-gray-200"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                <ActivitySquare className="w-6 h-6 mr-2 text-primary-start" />
                                Données Cliniques
                            </h2>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                            {successMsg}
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6">
                        
                        <div className="lg:w-1/3">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="w-16 h-16 bg-gradient-to-br from-primary-start to-primary-end rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        {patient.nom.charAt(0)}{patient.prenom.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{patient.nom} {patient.prenom}</h3>
                                        <p className="text-xs text-gray-500">ID: {patient.id}</p>
                                    </div>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-500">Âge</span><span className="font-bold">{patient.age || "—"} ans</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Sexe</span><span className="font-bold">{patient.sexe}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-2/3">
                            <form onSubmit={handleFormSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Poids (kg)</label>
                                        <input type="text" name="poids" value={parameters.poids} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Taille (cm)</label>
                                        <input type="text" name="taille" value={parameters.taille} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Pouls (bpm)</label>
                                        <input type="text" name="pouls" value={parameters.pouls} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" />
                                    </div>
                                     <div className="space-y-1">
                                         <label className="block text-xs font-bold text-gray-600 uppercase">Saturation SpO2 (%)</label>
                                         <input type="text" name="taux_oxygene" value={parameters.taux_oxygene} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" />
                                     </div>
                                     <div className="space-y-1">
                                         <label className="block text-xs font-bold text-gray-600 uppercase">Température (°C)</label>
                                         <input type="text" name="temperature" value={parameters.temperature} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" placeholder="Ex: 37.5" />
                                     </div>
                                     <div className="space-y-1">
                                         <label className="block text-xs font-bold text-gray-600 uppercase">Tension Artérielle (mmHg)</label>
                                         <input type="text" name="tension_arterielle" value={parameters.tension_arterielle} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" placeholder="Ex: 12/8 ou 120/80" />
                                     </div>
                                     <div className="space-y-1">
                                         <label className="block text-xs font-bold text-gray-600 uppercase">Fréquence respiratoire (/min)</label>
                                         <input type="text" name="frequence_respiratoire" value={parameters.frequence_respiratoire} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" placeholder="Ex: 16" />
                                     </div>
                                     <div className="space-y-1">
                                         <label className="block text-xs font-bold text-gray-600 uppercase">Glycémie (g/L)</label>
                                         <input type="text" name="glycemie" value={parameters.glycemie} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" placeholder="Ex: 1.0" />
                                     </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Groupe Sanguin</label>
                                        <select name="groupe_sanguin" value={parameters.groupe_sanguin} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start">
                                            <option value="">-</option>
                                            <option value="A">A</option><option value="B">B</option><option value="AB">AB</option><option value="O">O</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Facteur Rhésus</label>
                                        <select name="facteur_rhesus" value={parameters.facteur_rhesus} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start">
                                            <option value="">-</option>
                                            <option value="POSITIF">Positif (+)</option><option value="NEGATIF">Négatif (-)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Électrophorèse d&apos;Hb</label>
                                        <select name="electrophorese_hb" value={parameters.electrophorese_hb} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start">
                                            <option value="">—</option>
                                            <option value="AA">AA</option>
                                            <option value="AS">AS</option>
                                            <option value="SS">SS</option>
                                        </select>
                                    </div>
                                    <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-4">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3">Allergies (RG-WP-013)</h4>
                                        <div className="flex gap-4 mb-4">
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="radio" name="a_des_allergies" value="non" checked={parameters.a_des_allergies === 'non'} onChange={handleInputChange} />
                                                Aucune allergie connue
                                            </label>
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="radio" name="a_des_allergies" value="oui" checked={parameters.a_des_allergies === 'oui'} onChange={handleInputChange} />
                                                Allergies connues
                                            </label>
                                        </div>
                                    </div>
                                    {parameters.a_des_allergies === 'oui' && (
                                    <>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Allergie — Déclencheur</label>
                                        <input type="text" name="allergie_declencheur" value={parameters.allergie_declencheur} onChange={handleInputChange} placeholder="Ex: Pénicilline" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-bold text-gray-600 uppercase">Allergie — Manifestation</label>
                                        <input type="text" name="allergie_manifestation" value={parameters.allergie_manifestation} onChange={handleInputChange} placeholder="Ex: Éruption cutanée" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start" />
                                    </div>
                                    </>
                                    )}

                                    <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                            <FlaskConical className="w-4 h-4" /> Antécédents médicaux (RG-WP-008)
                                        </h4>
                                        <div className="flex gap-4 mb-4">
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="radio" name="a_des_antecedents" value="non" checked={parameters.a_des_antecedents === 'non'} onChange={handleInputChange} />
                                                Aucun antécédent connu
                                            </label>
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="radio" name="a_des_antecedents" value="oui" checked={parameters.a_des_antecedents === 'oui'} onChange={handleInputChange} />
                                                Antécédents connus
                                            </label>
                                        </div>
                                        {parameters.a_des_antecedents === 'oui' && (
                                            <div className="space-y-6">
                                                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                                                    <p className="text-xs font-bold text-gray-700 uppercase mb-3">Antécédents médicaux (personnels)</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-bold text-gray-600 uppercase">Intitulé</label>
                                                            <input type="text" name="antecedent_medical_nom" value={parameters.antecedent_medical_nom} onChange={handleInputChange} placeholder="Ex: Hypertension, Diabète type 2" className="w-full px-4 py-2 border rounded-lg bg-white" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-600 uppercase">Date</label>
                                                            <input type="date" name="antecedent_medical_date" value={parameters.antecedent_medical_date} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg bg-white" />
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-bold text-gray-600 uppercase">Description clinique</label>
                                                            <textarea name="antecedent_medical_description" value={parameters.antecedent_medical_description} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 border rounded-lg bg-white" placeholder="Contexte, gravité, évolution…" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                                                    <p className="text-xs font-bold text-gray-700 uppercase mb-3">Antécédents familiaux</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-bold text-gray-600 uppercase">Intitulé</label>
                                                            <input type="text" name="antecedent_familial_nom" value={parameters.antecedent_familial_nom} onChange={handleInputChange} placeholder="Ex: Diabète chez le père" className="w-full px-4 py-2 border rounded-lg bg-white" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-600 uppercase">Date (facultatif)</label>
                                                            <input type="date" name="antecedent_familial_date" value={parameters.antecedent_familial_date} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg bg-white" />
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-bold text-gray-600 uppercase">Description</label>
                                                            <textarea name="antecedent_familial_description" value={parameters.antecedent_familial_description} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 border rounded-lg bg-white" placeholder="Lien de parenté, contexte…" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {patient.antecedents?.length > 0 && (
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="font-bold text-gray-700 mb-1">Antécédents médicaux enregistrés</p>
                                                    <ul className="text-gray-600 list-disc pl-5">
                                                        {patient.antecedents.filter((a) => a.type === 'MEDICAL').map((a) => (
                                                            <li key={a.id}>{a.nom}{a.date ? ` (${a.date})` : ''}</li>
                                                        ))}
                                                        {!patient.antecedents.some((a) => a.type === 'MEDICAL') && (
                                                            <li className="italic text-gray-400 list-none">Aucun</li>
                                                        )}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-700 mb-1">Antécédents familiaux enregistrés</p>
                                                    <ul className="text-gray-600 list-disc pl-5">
                                                        {patient.antecedents.filter((a) => a.type === 'FAMILIAL').map((a) => (
                                                            <li key={a.id}>{a.nom}{a.description ? ` — ${a.description}` : ''}</li>
                                                        ))}
                                                        {!patient.antecedents.some((a) => a.type === 'FAMILIAL') && (
                                                            <li className="italic text-gray-400 list-none">Aucun</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <NursePatientAdminSection
                                        patientId={id}
                                        dossier={patient}
                                        adminForm={adminForm}
                                        setAdminForm={setAdminForm}
                                        onSaved={async () => {
                                            setSuccessMsg('Dossier administratif mis à jour.');
                                            await fetchPatientDetails();
                                        }}
                                    />

                                    <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-4">
                                        <h4 className="text-sm font-bold text-gray-700 mb-2">Traitements en cours</h4>
                                        {traitementsEnCours.length > 0 ? (
                                            <ul className="text-sm text-gray-600 list-disc pl-5">
                                                {traitementsEnCours.map((t) => (
                                                    <li key={t.id}>
                                                        {t.nom_medicament} — {t.posologie}
                                                        {t.maladie ? ` (${t.maladie})` : ''}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-gray-400 italic">Aucun traitement en cours enregistré (distinct des antécédents).</p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 bg-gray-50 flex justify-end">
                                    <button type="submit" disabled={isSaving} className="px-8 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white font-bold rounded-lg shadow-md disabled:opacity-60">
                                        {isSaving ? "Enregistrement…" : "Enregistrer"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </NurseNavBar>

            <ConfirmSaveParameters 
                isOpen={isConfirmModalOpen}
                onClose={() => !isSaving && setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmSave}
                parameters={parameters}
                patientName={`${patient.nom} ${patient.prenom}`}
                isSaving={isSaving}
            />
        </CustomDashboard>
    );
};

export default PatientParameters;
