import PropTypes from 'prop-types';
import { AlertTriangle, Calendar, Clock, Receipt } from 'lucide-react';

const formatFcfa = (value) =>
    new Intl.NumberFormat('fr-FR').format(Number(value) || 0);

const modeLabel = (mode) => ({
    especes: 'Espèces',
    mobile_money: 'Mobile Money',
    cheque: 'Chèque',
    carte: 'Carte',
    virement: 'Virement',
    assurance: 'Assurance',
}[mode] || mode);

function ActeRow({ acte, highlight }) {
    const isUnpaid = acte.statut_encaissement === 'impaye';
    return (
        <li className={`flex justify-between gap-3 text-sm py-2 border-b border-gray-100 last:border-0 ${highlight ? 'bg-red-50 -mx-2 px-2 rounded' : ''}`}>
            <div>
                <p className="font-medium text-gray-800">{acte.libelle}</p>
                <p className="text-xs text-gray-500">
                    {acte.date_heure ? new Date(acte.date_heure).toLocaleString('fr-FR') : '—'}
                    {acte.jours_depuis != null && (
                        <span className="text-red-600 font-medium"> — il y a {acte.jours_depuis} j</span>
                    )}
                </p>
            </div>
            <div className="text-right shrink-0">
                <p className="font-semibold">{formatFcfa(acte.tarif_indicatif ?? acte.montant)} FCFA</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isUnpaid ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {isUnpaid ? 'À payer' : 'Payé'}
                </span>
            </div>
        </li>
    );
}

ActeRow.propTypes = {
    acte: PropTypes.object.isRequired,
    highlight: PropTypes.bool,
};

export default function PatientBillingPanel({ fiche, loading }) {
    PatientBillingPanel.propTypes = {
        fiche: PropTypes.object,
        loading: PropTypes.bool,
    };

    if (loading) {
        return <p className="text-sm text-gray-500 py-4">Chargement de la fiche patient…</p>;
    }
    if (!fiche) return null;

    const {
        actes_aujourdhui = [],
        actes_impayes_historique = [],
        encaissements_deja_effectues = [],
        montant_restant_total = 0,
        montant_deja_encaisse = 0,
        alerte_impayes_anciens,
        medical_available,
    } = fiche;

    return (
        <div className="space-y-4">
            {!medical_available && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Données médicales indisponibles — affichage des encaissements compta uniquement.
                </p>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600 font-bold uppercase">Reste à payer</p>
                    <p className="text-xl font-bold text-red-700">{formatFcfa(montant_restant_total)} FCFA</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 font-bold uppercase">Déjà encaissé</p>
                    <p className="text-xl font-bold text-green-700">{formatFcfa(montant_deja_encaisse)} FCFA</p>
                </div>
            </div>

            {alerte_impayes_anciens && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Ce patient a des actes passés non encaissés — vérifiez avant d&apos;encaisser.
                </div>
            )}

            <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4" /> Aujourd&apos;hui
                </h4>
                {actes_aujourdhui.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucun acte enregistré aujourd&apos;hui.</p>
                ) : (
                    <ul>{actes_aujourdhui.map((a) => <ActeRow key={a.id || a.libelle} acte={a} />)}</ul>
                )}
            </div>

            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50/30">
                <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" /> Impayés antérieurs
                </h4>
                {actes_impayes_historique.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucun impayé antérieur.</p>
                ) : (
                    <ul>{actes_impayes_historique.map((a) => <ActeRow key={a.id || a.libelle} acte={a} highlight />)}</ul>
                )}
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                    <Receipt className="w-4 h-4" /> Déjà encaissé
                </h4>
                {encaissements_deja_effectues.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucune quittance validée.</p>
                ) : (
                    <ul className="space-y-2">
                        {encaissements_deja_effectues.map((q) => (
                            <li key={q.numero} className="flex justify-between text-sm">
                                <div>
                                    <span className="font-medium">{q.numero}</span>
                                    <span className="text-gray-500 ml-2">{q.date}</span>
                                    <p className="text-xs text-gray-500">{q.motif}</p>
                                    <p className="text-xs text-blue-600">{modeLabel(q.mode_paiement)} — {q.mode_paiement_detail}</p>
                                </div>
                                <span className="font-semibold text-green-700">{formatFcfa(q.montant)} FCFA</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
