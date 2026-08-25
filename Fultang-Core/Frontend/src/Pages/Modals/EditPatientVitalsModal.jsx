import { useState, useEffect } from 'react';
import { Modal, Input, Select, InputNumber } from 'antd';
import { HeartPulse, FileText, Activity } from 'lucide-react';
import { getPatientDossier, updateDossierMedical } from '../../services/medicalDossierApi';
import { useFeedback } from '../../contexts/FeedbackContext.jsx';

const { TextArea } = Input;
const { Option } = Select;

/**
 * Modal pour éditer les constantes vitales et informations du dossier patient.
 */
export function EditPatientVitalsModal({ isOpen, onClose, patientId, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const { showSuccess, showError } = useFeedback();

    const [groupeOnly, setGroupeOnly] = useState(null);

    const [formData, setFormData] = useState({
        groupe_sanguin: null,
        facteur_rhesus: null,
        poids: null,
        taille: null,
        pouls: null,
        taux_oxygene: null,
        electrophorese_hb: '',
        allergie_declencheur: '',
        allergie_manifestation: '',
        antecedent_type: 'MEDICAL',
        antecedent_nom: '',
        antecedent_date: '',
        antecedent_description: '',
    });

    useEffect(() => {
        if (isOpen && patientId) {
            fetchDossierData();
        }
    }, [isOpen, patientId]);

    const fetchDossierData = async () => {
        setFetching(true);
        try {
            const dossier = await getPatientDossier(patientId);
            const dc = dossier.donnees_cliniques || {};
            const grp = dc.groupe_sanguin || null;
            setGroupeOnly(grp);

            setFormData({
                groupe_sanguin: grp,
                facteur_rhesus: dc.facteur_rhesus || null,
                poids: dc.poids || null,
                taille: dc.taille || null,
                pouls: dc.pouls || null,
                taux_oxygene: dc.taux_oxygene || null,
                electrophorese_hb: dc.electrophorese_hb || '',
                allergie_declencheur: dossier.allergies?.[0]?.declencheur || '',
                allergie_manifestation: dossier.allergies?.[0]?.manifestation || '',
                antecedent_type: 'MEDICAL',
                antecedent_nom: '',
                antecedent_date: new Date().toISOString().slice(0, 10),
                antecedent_description: '',
            });
        } catch (error) {
            console.error('Erreur chargement dossier:', error);
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleGroupeChange = (val) => {
        setGroupeOnly(val);
        setFormData((prev) => ({ ...prev, groupe_sanguin: val }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await updateDossierMedical(patientId, formData);
            showSuccess('Dossier médical mis à jour avec succès', 'Succès');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Erreur mise à jour dossier:', error);
            const data = error.response?.data;
            const msg = typeof data === 'object'
                ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' — ')
                : 'Impossible de mettre à jour le dossier.';
            showError(msg, 'Erreur');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={600}
            centered
            title={
                <div className="flex items-center gap-2 mb-4">
                    <HeartPulse className="w-6 h-6 text-red-500" />
                    <span className="text-xl font-bold text-gray-800">Données Médicales</span>
                </div>
            }
        >
            <div className="p-2 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Métriques corporelles
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Poids</label>
                            <Input
                                value={formData.poids}
                                onChange={(e) => handleChange('poids', e.target.value)}
                                placeholder="Ex: 75 kg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Taille</label>
                            <Input
                                value={formData.taille}
                                onChange={(e) => handleChange('taille', e.target.value)}
                                placeholder="Ex: 175 cm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Pouls</label>
                            <Input
                                value={formData.pouls}
                                onChange={(e) => handleChange('pouls', e.target.value)}
                                placeholder="Ex: 72 bpm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">SpO2</label>
                            <Input
                                value={formData.taux_oxygene}
                                onChange={(e) => handleChange('taux_oxygene', e.target.value)}
                                placeholder="Ex: 98%"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h3 className="text-sm font-bold text-red-800 mb-3">Groupe sanguin</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            placeholder="Groupe"
                            value={groupeOnly}
                            onChange={handleGroupeChange}
                            className="w-full"
                        >
                            <Option value="A">A</Option>
                            <Option value="B">B</Option>
                            <Option value="AB">AB</Option>
                            <Option value="O">O</Option>
                        </Select>
                        <Select
                            placeholder="Rhésus"
                            value={formData.facteur_rhesus}
                            onChange={(val) => handleChange('facteur_rhesus', val)}
                            className="w-full"
                        >
                            <Option value="POSITIF">Positif (+)</Option>
                            <Option value="NEGATIF">Négatif (-)</Option>
                        </Select>
                    </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                    <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Allergies & antécédents
                    </h3>
                    <div className="space-y-3">
                        <Input
                            placeholder="Allergie — déclencheur"
                            value={formData.allergie_declencheur}
                            onChange={(e) => handleChange('allergie_declencheur', e.target.value)}
                        />
                        <Input
                            placeholder="Allergie — manifestation"
                            value={formData.allergie_manifestation}
                            onChange={(e) => handleChange('allergie_manifestation', e.target.value)}
                        />
                        <Select
                            value={formData.antecedent_type}
                            onChange={(val) => handleChange('antecedent_type', val)}
                            className="w-full"
                        >
                            <Option value="MEDICAL">Antécédent médical</Option>
                            <Option value="FAMILIAL">Antécédent familial</Option>
                        </Select>
                        <Input
                            placeholder="Nouvel antécédent (intitulé)"
                            value={formData.antecedent_nom}
                            onChange={(e) => handleChange('antecedent_nom', e.target.value)}
                        />
                        <TextArea
                            rows={3}
                            placeholder="Description de l'antécédent"
                            value={formData.antecedent_description}
                            onChange={(e) => handleChange('antecedent_description', e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 font-semibold">
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || fetching}
                        className="px-6 py-2 bg-[#1A73A3] text-white font-bold rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
