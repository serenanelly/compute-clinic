import React, { useState, useEffect } from 'react';
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { specialistNavLink } from "./lib/specialistNavLink.js";
import { Loading } from "../../GlobalComponents/Loading.jsx";
import { doctorApi } from "../../services/doctorApi.js";
import { FlaskConical, Search, CheckCircle, Clock, Microscope } from 'lucide-react';

export const SpecialistExamsList = () => {
    const [examens, setExamens] = useState([]);
    const [filteredExamens, setFilteredExamens] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("TOUS");

    // States for result recording modal
    const [selectedExam, setSelectedExam] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Matching backend fields: resultats, observations, interpretation, doctor_id
    const [resultForm, setResultForm] = useState({ resultats: '', observations: '', interpretation: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchExamens();
    }, []);

    useEffect(() => {
        let filtered = examens;

        if (statusFilter !== "TOUS") {
            filtered = filtered.filter(e => e.statut === statusFilter);
        }

        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(e => 
                (e.nom?.toLowerCase().includes(lowerSearch)) || 
                (e.patient?.nom?.toLowerCase().includes(lowerSearch)) ||
                (e.patient?.prenom?.toLowerCase().includes(lowerSearch))
            );
        }
        setFilteredExamens(filtered);
    }, [searchTerm, statusFilter, examens]);

    const fetchExamens = async () => {
        try {
            setIsLoading(true);
            const data = await doctorApi.getExamens();
            setExamens(data);
            setFilteredExamens(data);
        } catch (error) {
            console.error("Failed to fetch exams", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return "—";
        return new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleOpenModal = (exam) => {
        setSelectedExam(exam);
        setResultForm({ resultats: '', observations: '', interpretation: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedExam(null);
    };

    const handleSaveResult = async (e) => {
        e.preventDefault();
        if (!selectedExam) return;
        
        try {
            setIsSaving(true);
            // On récupère le user_id du token ou local storage (simulé ici par un UUID pour le besoin)
            // Dans l'app finale: const doctorId = authState.user.id
            const doctorId = "00000000-0000-0000-0000-000000000000"; 

            // Save the result using the custom @action which also updates the status
            await doctorApi.saveExamResult(selectedExam.id, {
                doctor_id: doctorId,
                resultats: resultForm.resultats,
                observations: resultForm.observations,
                interpretation: resultForm.interpretation
            });
            
            // Refresh list
            handleCloseModal();
            fetchExamens();
        } catch (error) {
            alert("Erreur lors de l'enregistrement du résultat.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <CustomDashboard linkList={specialistNavLink} requiredRole="medecin_specialiste">
            <div className="p-6 h-[calc(100vh-60px)] flex flex-col bg-gray-50/50">
                
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                            <FlaskConical className="w-7 h-7 mr-2 text-purple-600" />
                            Résultats d'Examens Spécialisés
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Interprétez les résultats de laboratoire et d'imagerie de vos patients</p>
                    </div>
                </div>

                <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-white p-2 rounded-xl shadow-sm border border-gray-200 relative">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Rechercher par examen ou patient..." 
                            className="w-full pl-12 pr-4 py-1 bg-transparent border-none focus:ring-0 outline-none"
                        />
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                        {["TOUS", "EN_ATTENTE", "REALISE"].map(stat => (
                            <button key={stat} onClick={() => setStatusFilter(stat)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusFilter === stat ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
                                {stat === 'TOUS' ? 'Tous' : stat === 'EN_ATTENTE' ? 'En Attente' : 'Résultats dispo'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                    {isLoading ? (
                        <div className="flex-1 flex justify-center items-center"><Loading /></div>
                    ) : (
                        <div className="overflow-y-auto flex-1 scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white shadow-sm z-10">
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                        <th className="p-4 pl-6">Examen Spécialisé</th>
                                        <th className="p-4">Patient</th>
                                        <th className="p-4">Prescrit le</th>
                                        <th className="p-4">Statut</th>
                                        <th className="p-4 pr-6">Résultat & Interprétation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredExamens.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-gray-500">
                                                <Microscope className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                                <p className="font-medium">Aucun examen trouvé</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredExamens.map((exam) => (
                                            <tr key={exam.id} className="hover:bg-purple-50/30 transition-colors group">
                                                <td className="p-4 pl-6">
                                                    <div className="font-bold text-gray-800">{exam.nom || exam.nom_examen || "Examen sans nom"}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{exam.motif || "Pas de motif spécifié"}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-700">{exam.patient?.nom} {exam.patient?.prenom}</div>
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    {formatDate(exam.date_prescription)}
                                                </td>
                                                <td className="p-4">
                                                    {exam.statut === 'EN_ATTENTE' ? (
                                                        <span className="flex items-center text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded w-max">
                                                            <Clock className="w-3 h-3 mr-1" /> En attente
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded w-max">
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Réalisé
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 pr-6">
                                                    {exam.statut === 'REALISE' && exam.resultat ? (
                                                        <div className="text-sm text-gray-700 p-2 bg-purple-50 rounded border border-purple-100">
                                                            <span className="font-bold text-purple-800">Résultat:</span> {exam.resultat.resultats} <br/>
                                                            {exam.resultat.interpretation && <span className="text-xs text-purple-600 italic mt-1 block">Interprétation: {exam.resultat.interpretation}</span>}
                                                            {exam.resultat.observations && <span className="text-xs text-gray-500 italic mt-1 block">Obs: {exam.resultat.observations}</span>}
                                                        </div>
                                                    ) : exam.statut === 'EN_ATTENTE' ? (
                                                        <button 
                                                            onClick={() => handleOpenModal(exam)}
                                                            className="text-xs font-bold bg-purple-600 text-white px-3 py-1.5 rounded shadow-sm hover:bg-purple-700 transition-colors"
                                                        >
                                                            Enregistrer le résultat
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-sm">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal d'enregistrement des résultats */}
                {isModalOpen && selectedExam && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                                <h3 className="font-bold text-lg flex items-center">
                                    <FlaskConical className="w-5 h-5 mr-2" />
                                    Résultat d'examen
                                </h3>
                                <button onClick={handleCloseModal} className="text-white/80 hover:text-white">&times;</button>
                            </div>
                            <div className="p-5">
                                <div className="mb-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                    <p className="text-sm"><span className="font-bold text-purple-800">Examen :</span> {selectedExam.nom || selectedExam.nom_examen}</p>
                                    <p className="text-sm mt-1"><span className="font-bold text-purple-800">Patient :</span> {selectedExam.patient?.nom} {selectedExam.patient?.prenom}</p>
                                    <p className="text-sm mt-1 text-gray-600 italic">Motif : {selectedExam.motif}</p>
                                </div>
                                <form onSubmit={handleSaveResult} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Résultats détaillés *</label>
                                        <textarea 
                                            value={resultForm.resultats}
                                            onChange={(e) => setResultForm({...resultForm, resultats: e.target.value})}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            rows="3"
                                            placeholder="Saisissez les résultats techniques..."
                                            required
                                        ></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Interprétation (Optionnel)</label>
                                        <input 
                                            type="text" 
                                            value={resultForm.interpretation}
                                            onChange={(e) => setResultForm({...resultForm, interpretation: e.target.value})}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder="Ex: Normale, Pathologique..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observations (Optionnel)</label>
                                        <textarea 
                                            value={resultForm.observations}
                                            onChange={(e) => setResultForm({...resultForm, observations: e.target.value})}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            rows="2"
                                            placeholder="Remarques complémentaires..."
                                        ></textarea>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button 
                                            type="button" 
                                            onClick={handleCloseModal}
                                            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200"
                                        >
                                            Annuler
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={isSaving}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-md flex items-center"
                                        >
                                            {isSaving ? 'Enregistrement...' : 'Enregistrer le résultat'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </CustomDashboard>
    );
};

export default SpecialistExamsList;
