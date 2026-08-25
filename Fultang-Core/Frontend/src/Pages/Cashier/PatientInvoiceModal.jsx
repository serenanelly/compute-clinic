import { useState, useEffect } from 'react';
import { Modal, AutoComplete, Input } from 'antd';
import { DollarSign, X, Printer, History, Wallet, AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';
import {
    getPatientQuittances,
    createQuittance,
    validerQuittance,
} from '../../services/quittancesApi';
import { getFicheEncaissement, getCaisseOuverte } from '../../services/caissierApi';
import PatientBillingPanel from './PatientBillingPanel.jsx';
import { useFeedback } from '../../contexts/FeedbackContext.jsx';
import { useAuthentication } from '../../Utils/Provider.jsx';
import Loader from '../../GlobalComponents/Loader';
import { MOTIFS_QUITTANCE } from '../../constants/motifsCaisse.js';

const formatFcfa = (value) =>
    new Intl.NumberFormat('fr-FR').format(Number(value) || 0);

function inferTypeRecette(prestations = []) {
    if (!prestations.length) return 'consultation';
    const types = prestations.map((p) => p.type_recette || p.categorie || 'autre');
    if (types.every((t) => t === 'consultation')) return 'consultation';
    if (types.some((t) => t === 'laboratoire')) return 'laboratoire';
    if (types.some((t) => t === 'imagerie')) return 'imagerie';
    return 'autre';
}

export default function PatientInvoiceModal({
    isOpen,
    onClose,
    patient,
    mode = 'facturer',
    onSuccess,
}) {
    PatientInvoiceModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        patient: PropTypes.object,
        mode: PropTypes.oneOf(['facturer', 'historique']),
        onSuccess: PropTypes.func,
    };

    const [quittances, setQuittances] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validerImmediatement, setValiderImmediatement] = useState(true);
    const [showPrintConfirm, setShowPrintConfirm] = useState(false);
    const [newlyCreatedQuittance, setNewlyCreatedQuittance] = useState(null);
    const { showSuccess, showError, showWarning } = useFeedback();
    const { userData } = useAuthentication();

    const [fiche, setFiche] = useState(null);
    const [ficheLoading, setFicheLoading] = useState(false);
    const [caisseOuverte, setCaisseOuverte] = useState(null);
    const [caisseLoading, setCaisseLoading] = useState(false);

    const prestations = fiche?.prestations_a_payer || patient?.prestations_a_payer || [];
    const montantSuggere =
        fiche?.montant_restant_total ??
        patient?.montant_restant_total ??
        patient?.montant_restant ??
        patient?.montant_total_suggere ??
        prestations.reduce((s, p) => s + (Number(p.montant) || 0), 0);
    const motifSuggere =
        patient?.motif_caisse ||
        prestations.map((p) => p.libelle).join(' ; ') ||
        'Paiement prestations médicales';

    const [formData, setFormData] = useState({
        montant: '',
        motif: '',
        mode_paiement: 'especes',
        cheque_numero: '',
        cheque_banque: '',
        cheque_titulaire: '',
        mobile_numero: '',
        mobile_operateur: 'orange',
        mobile_reference: '',
        carte_numero: '',
        carte_reference: '',
        virement_banque: '',
        virement_reference: '',
        virement_date: new Date().toISOString().slice(0, 10),
        taux_couverture: '80',
    });

    const isFacturerMode = mode === 'facturer';

    const loadFiche = async () => {
        if (!patient?.id) return;
        setFicheLoading(true);
        try {
            const res = await getFicheEncaissement(patient.id);
            if (res.success) setFiche(res.data);
        } catch (err) {
            console.error('Fiche encaissement:', err);
        } finally {
            setFicheLoading(false);
        }
    };

    const loadCaisse = async () => {
        setCaisseLoading(true);
        try {
            const res = await getCaisseOuverte();
            setCaisseOuverte(res?.ouverte ? res.caisse : null);
        } catch {
            setCaisseOuverte(null);
        } finally {
            setCaisseLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && patient) {
            loadQuittances();
            loadFiche();
            if (mode === 'facturer') loadCaisse();
            const prest = patient.prestations_a_payer || [];
            const montant =
                patient.montant_restant_total ??
                patient.montant_restant ??
                patient.montant_total_suggere ??
                prest.reduce((s, p) => s + (Number(p.montant) || 0), 0);
            const motif =
                patient.motif_caisse ||
                prest.map((p) => p.libelle).join(' ; ') ||
                'Paiement prestations médicales';
            setFormData((prev) => ({
                ...prev,
                montant: montant ? String(montant) : '',
                motif,
                mode_paiement: 'especes',
            }));
            setValiderImmediatement(true);
        }
    }, [isOpen, patient?.id]);

    useEffect(() => {
        if (fiche && isFacturerMode) {
            const montant = fiche.montant_restant_total ?? 0;
            const motif =
                fiche.prestations_a_payer?.map((p) => p.libelle).join(' ; ') ||
                'Paiement prestations médicales';
            if (montant > 0) {
                setFormData((prev) => ({
                    ...prev,
                    montant: String(montant),
                    motif,
                }));
            }
        }
    }, [fiche, mode, isFacturerMode]);

    const loadQuittances = async () => {
        if (!patient?.id) return;
        setLoading(true);
        try {
            const response = await getPatientQuittances(patient.id);
            if (response.success) {
                setQuittances(response.data || []);
            }
        } catch (error) {
            console.error('Error loading quittances:', error);
            showError('Erreur lors du chargement des quittances.', 'Échec');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'mobile_numero') {
            setFormData((prev) => ({
                ...prev,
                [name]: value.replace(/\D/g, '').slice(0, 9),
            }));
            return;
        }
        if (name === 'carte_numero') {
            setFormData((prev) => ({
                ...prev,
                [name]: value.replace(/\D/g, '').slice(0, 4),
            }));
            return;
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmitQuittance = async (e) => {
        e.preventDefault();

        if (!caisseOuverte) {
            showError(
                'Aucune caisse ouverte actuellement. Ouvrez la caisse journalière avant d\'encaisser.',
                'Caisse fermée',
            );
            return;
        }

        if (!formData.montant || !formData.motif) {
            showWarning('Veuillez remplir le montant et le motif.', 'Champs requis');
            return;
        }

        if (formData.mode_paiement === 'mobile_money') {
            if (!formData.mobile_numero || formData.mobile_numero.length !== 9) {
                showWarning('Le numéro Mobile Money doit contenir 9 chiffres.', 'Validation');
                return;
            }
        }
        if (formData.mode_paiement === 'carte') {
            if (!formData.carte_numero || formData.carte_numero.length !== 4) {
                showWarning('Les 4 derniers chiffres de la carte sont requis.', 'Validation');
                return;
            }
        }

        if (formData.mode_paiement === 'virement') {
            if (!formData.virement_banque || !formData.virement_reference) {
                showWarning('Banque et référence virement requis.', 'Validation');
                return;
            }
        }

        const montantNum = parseFloat(formData.montant);
        if (montantSuggere > 0 && montantNum < montantSuggere) {
            showWarning(
                `Le montant saisi (${formatFcfa(montantNum)}) est inférieur au total dû (${formatFcfa(montantSuggere)} FCFA).`,
                'Attention',
            );
        }

        setSubmitting(true);
        try {
            const rawCaissierId = userData?.idpersonnel ?? userData?.id ?? userData?.user_id;
            const caissierId = Number.isInteger(rawCaissierId)
                ? rawCaissierId
                : (typeof rawCaissierId === 'string' && /^\d+$/.test(rawCaissierId)
                    ? parseInt(rawCaissierId, 10)
                    : null);
            const payload = {
                montant: montantNum,
                motif: formData.motif,
                mode_paiement: formData.mode_paiement,
                type_recette: inferTypeRecette(prestations),
                patient_id: String(patient.id),
                session_id: patient.id_session || null,
                est_validee: validerImmediatement,
                cheque_numero: formData.cheque_numero,
                cheque_banque: formData.cheque_banque,
                cheque_titulaire: formData.cheque_titulaire,
                mobile_numero: formData.mobile_numero,
                mobile_operateur: formData.mobile_operateur,
                mobile_reference: formData.mobile_reference,
                carte_numero: formData.carte_numero,
                carte_reference: formData.carte_reference,
                virement_banque: formData.virement_banque,
                virement_reference: formData.virement_reference,
                virement_date: formData.virement_date,
            };
            if (formData.mode_paiement === 'assurance') {
                payload.taux_couverture = parseFloat(formData.taux_couverture || '0');
                payload.est_assure = true;
            }
            if (caissierId != null) {
                payload.caissier_id = caissierId;
            }

            const created = await createQuittance(payload);
            let finalQuittance = created;

            if (validerImmediatement && !created?.est_validee && created?.id) {
                try {
                    finalQuittance = await validerQuittance(created.id);
                } catch (valErr) {
                    console.warn('Validation auto échouée:', valErr);
                }
            }

            const msg = validerImmediatement
                ? 'Reçu créé et validé avec succès.'
                : 'Reçu créé — en attente de validation.';
            showSuccess(msg, 'Quittance');

            setNewlyCreatedQuittance({
                numero: finalQuittance?.numero || created?.numero,
                numero_quittance: finalQuittance?.numero || created?.numero,
                montant: payload.montant,
                Montant_paye: payload.montant,
                motif: payload.motif,
                Motif: payload.motif,
                mode_paiement: payload.mode_paiement,
                date_paiement: new Date().toISOString(),
            });
            setShowPrintConfirm(true);
            await loadQuittances();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error creating quittance:', error);
            const detail =
                error.response?.data?.detail ||
                error.response?.data?.error ||
                JSON.stringify(error.response?.data) ||
                'Erreur lors de la création de la quittance.';
            showError(typeof detail === 'string' ? detail : 'Erreur lors de la création.', 'Échec');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrintInvoice = (quittance) => {
        const numero = quittance.numero || quittance.numero_quittance;
        const montant = quittance.montant || quittance.Montant_paye;
        const motif = quittance.motif || quittance.Motif;
        const printContent = `
            <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
            <title>Quittance ${numero}</title>
            <style>
                body{font-family:Arial,sans-serif;padding:30px;}
                h1{color:#1e40af;text-align:center;}
                .amount{font-size:28px;font-weight:bold;color:#059669;text-align:center;margin:20px 0;}
            </style></head><body>
            <h1>POLYCLINIQUE FULTANG</h1>
            <h2 style="text-align:center;">QUITTANCE N° ${numero}</h2>
            <p><strong>Patient:</strong> ${patient?.prenom || ''} ${patient?.nom || ''} (${patient?.matricule || ''})</p>
            <p><strong>Motif:</strong> ${motif}</p>
            <p><strong>Mode:</strong> ${quittance.mode_paiement || 'espèces'}</p>
            ${quittance.mode_paiement_detail ? `<p><strong>Détail:</strong> ${quittance.mode_paiement_detail}</p>` : ''}
            <div class="amount">${formatFcfa(montant)} FCFA</div>
            <p style="text-align:center;font-size:11px;color:#666;">Document généré le ${new Date().toLocaleString('fr-FR')}</p>
            </body></html>`;
        const w = window.open('', '_blank');
        w.document.write(printContent);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
    };

    const handleClose = () => {
        setShowPrintConfirm(false);
        setNewlyCreatedQuittance(null);
        onClose();
    };

    const title = isFacturerMode ? 'Encaissement — Quittance' : 'Historique des quittances';

    return (
        <>
            <Modal
                open={showPrintConfirm}
                onCancel={() => {
                    setShowPrintConfirm(false);
                    setNewlyCreatedQuittance(null);
                }}
                footer={null}
                width={420}
                centered
            >
                <div className="p-4 text-center">
                    <Printer className="w-10 h-10 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold mb-4">Quittance enregistrée</h3>
                    {newlyCreatedQuittance && (
                        <p className="text-2xl font-bold text-green-600 mb-4">
                            {formatFcfa(newlyCreatedQuittance.montant)} FCFA
                        </p>
                    )}
                    <div className="flex gap-2 justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                setShowPrintConfirm(false);
                                setNewlyCreatedQuittance(null);
                            }}
                            className="px-4 py-2 border rounded-lg"
                        >
                            Fermer
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                handlePrintInvoice(newlyCreatedQuittance);
                                setShowPrintConfirm(false);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" /> Imprimer
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={isOpen}
                onCancel={handleClose}
                footer={null}
                width={920}
                title={null}
            >
                <div className="p-2">
                    <div className="mb-5 pb-4 border-b">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            {isFacturerMode ? (
                                <Wallet className="w-7 h-7 text-green-600" />
                            ) : (
                                <History className="w-7 h-7 text-blue-600" />
                            )}
                            {title}
                        </h2>
                        {patient && (
                            <p className="text-gray-600 mt-2">
                                <strong>{patient.prenom} {patient.nom}</strong>
                                {' — '}{patient.matricule}
                            </p>
                        )}
                    </div>

                    {(isFacturerMode || mode === 'historique') && (
                        <div className="mb-5">
                            <PatientBillingPanel fiche={fiche} loading={ficheLoading} />
                        </div>
                    )}

                    {/* Prestations */}
                    {prestations.length > 0 && (
                        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="font-bold text-gray-800 mb-3">
                                Prestations à facturer
                            </h3>
                            <ul className="space-y-2">
                                {prestations.map((p) => (
                                    <li
                                        key={p.id || p.libelle}
                                        className="flex justify-between text-sm"
                                    >
                                        <span>{p.libelle}{p.motif ? ` — ${p.motif}` : ''}</span>
                                        <span className="font-semibold">
                                            {formatFcfa(p.montant)} FCFA
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex justify-between mt-3 pt-3 border-t border-blue-200 font-bold">
                                <span>Total indicatif</span>
                                <span className="text-primary-end">
                                    {formatFcfa(montantSuggere)} FCFA
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Formulaire facturation */}
                    {isFacturerMode && (
                        <form
                            onSubmit={handleSubmitQuittance}
                            className="bg-green-50 border border-green-200 rounded-lg p-5 mb-5"
                        >
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                Nouvelle quittance
                            </h3>
                            {caisseLoading ? (
                                <p className="text-sm text-gray-500 mb-4">Vérification de la caisse…</p>
                            ) : !caisseOuverte ? (
                                <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 text-sm flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Aucune caisse ouverte.</strong> Ouvrez la caisse journalière
                                        avant d&apos;enregistrer un encaissement.
                                    </span>
                                </div>
                            ) : (
                                <div className="mb-4 rounded-lg border border-green-300 bg-green-100/60 px-4 py-2 text-green-900 text-sm">
                                    Caisse ouverte — {caisseOuverte.libelle_periode || 'Période active'}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        Montant (FCFA) *
                                    </label>
                                    <input
                                        type="number"
                                        name="montant"
                                        value={formData.montant}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="1"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        Mode de paiement
                                    </label>
                                    <select
                                        name="mode_paiement"
                                        value={formData.mode_paiement}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        <option value="especes">Espèces</option>
                                        <option value="mobile_money">Mobile Money</option>
                                        <option value="cheque">Chèque</option>
                                        <option value="carte">Carte bancaire</option>
                                        <option value="virement">Virement</option>
                                        <option value="assurance">Assurance</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-semibold mb-1">
                                    Motif *
                                </label>
                                <AutoComplete
                                    value={formData.motif}
                                    options={MOTIFS_QUITTANCE.map((m) => ({ value: m }))}
                                    onChange={(value) =>
                                        setFormData((prev) => ({ ...prev, motif: value }))
                                    }
                                    filterOption={(input, option) =>
                                        (option?.value || '')
                                            .toLowerCase()
                                            .includes((input || '').toLowerCase())
                                    }
                                    placeholder="Rechercher ou sélectionner un motif…"
                                    className="w-full"
                                    allowClear
                                >
                                    <Input className="py-2" required />
                                </AutoComplete>
                                <p className="text-xs text-gray-400 mt-1">
                                    Tapez pour filtrer la liste, ou choisissez un motif dans le menu.
                                </p>
                            </div>

                            {formData.mode_paiement === 'cheque' && (
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <input name="cheque_numero" placeholder="N° chèque" value={formData.cheque_numero} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                    <input name="cheque_banque" placeholder="Banque" value={formData.cheque_banque} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                    <input name="cheque_titulaire" placeholder="Titulaire" value={formData.cheque_titulaire} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                </div>
                            )}

                            {formData.mode_paiement === 'mobile_money' && (
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <input name="mobile_numero" placeholder="N° (9 chiffres)" value={formData.mobile_numero} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                    <select name="mobile_operateur" value={formData.mobile_operateur} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm">
                                        <option value="orange">Orange</option>
                                        <option value="mtn">MTN</option>
                                    </select>
                                    <input name="mobile_reference" placeholder="Réf. transaction" value={formData.mobile_reference} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" />
                                </div>
                            )}

                            {formData.mode_paiement === 'carte' && (
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <input name="carte_numero" placeholder="4 derniers chiffres" value={formData.carte_numero} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                    <input name="carte_reference" placeholder="Réf. transaction" value={formData.carte_reference} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" />
                                </div>
                            )}

                            {formData.mode_paiement === 'virement' && (
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <input name="virement_banque" placeholder="Banque émettrice" value={formData.virement_banque} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                    <input name="virement_reference" placeholder="Référence virement" value={formData.virement_reference} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                    <input type="date" name="virement_date" value={formData.virement_date} onChange={handleInputChange} className="px-3 py-2 border rounded-lg text-sm" required />
                                </div>
                            )}

                            {formData.mode_paiement === 'assurance' && (
                                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Taux couverture (%)</label>
                                        <input type="number" name="taux_couverture" min="0" max="100" value={formData.taux_couverture} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg text-sm mt-1" />
                                    </div>
                                    <div className="text-sm text-gray-700 flex flex-col justify-end">
                                        {formData.montant && formData.taux_couverture && (
                                            <>
                                                <span>Assurance : {formatFcfa(parseFloat(formData.montant) * parseFloat(formData.taux_couverture) / 100)} FCFA</span>
                                                <span>Patient : {formatFcfa(parseFloat(formData.montant) * (1 - parseFloat(formData.taux_couverture) / 100))} FCFA</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {montantSuggere > 0 && Number(formData.montant) > 0 && Number(formData.montant) < montantSuggere && (
                                <p className="text-sm text-amber-700 flex items-center gap-1 mb-3">
                                    <AlertTriangle className="w-4 h-4" />
                                    Montant inférieur au total dû ({formatFcfa(montantSuggere)} FCFA)
                                </p>
                            )}

                            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={validerImmediatement}
                                    onChange={(e) => setValiderImmediatement(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Valider immédiatement (visible dans Quittances validées)
                                </span>
                            </label>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 border rounded-lg text-gray-700"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || Number(formData.montant) <= 0}
                                    className="px-5 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting ? 'Enregistrement…' : 'Créer la quittance'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Historique quittances */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-3">
                            Historique complet — quittances ({quittances.length})
                        </h3>
                        {!loading && quittances.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Total</p>
                                    <p className="text-lg font-bold text-blue-800">
                                        {formatFcfa(
                                            quittances.reduce(
                                                (s, q) => s + Number(q.montant || q.Montant_paye || 0),
                                                0
                                            )
                                        )}{' '}
                                        FCFA
                                    </p>
                                </div>
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Validées</p>
                                    <p className="text-lg font-bold text-green-800">
                                        {quittances.filter((q) => q.est_validee).length}
                                    </p>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Encaissé (validées)</p>
                                    <p className="text-lg font-bold text-amber-800">
                                        {formatFcfa(
                                            quittances
                                                .filter((q) => q.est_validee)
                                                .reduce(
                                                    (s, q) => s + Number(q.montant || q.Montant_paye || 0),
                                                    0
                                                )
                                        )}{' '}
                                        FCFA
                                    </p>
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader size="medium" color="primary-end" />
                            </div>
                        ) : quittances.length === 0 ? (
                            <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-lg">
                                Aucune quittance enregistrée pour ce patient.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {quittances.map((q) => (
                                    <div
                                        key={q.id || q.idQuittance}
                                        className="flex justify-between items-center bg-white border rounded-lg p-3"
                                    >
                                        <div>
                                            <span className="font-bold text-primary-end mr-2">
                                                {q.numero || q.numero_quittance}
                                            </span>
                                            <span className="text-green-700 font-semibold">
                                                {formatFcfa(q.montant || q.Montant_paye)} FCFA
                                            </span>
                                            <p className="text-sm text-gray-600 mt-0.5">
                                                {q.motif || q.Motif}
                                            </p>
                                            {q.mode_paiement_detail && (
                                                <p className="text-xs text-blue-600">{q.mode_paiement_detail}</p>
                                            )}
                                            {q.est_validee != null && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${q.est_validee ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {q.est_validee ? 'Validée' : 'À valider'}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handlePrintInvoice(q)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                            title="Imprimer"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-5 py-2 bg-gray-200 rounded-lg flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Fermer
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
