import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Briefcase, Building2, Calendar } from 'lucide-react';

/**
 * Modal affichant les details complets d'un personnel.
 */
export function PersonnelDetailsModal({ isOpen, onClose, personnel, onManagePrimes }) {
    const { t } = useTranslation();

    if (!personnel) return null;

    const InfoRow = ({ icon: Icon, label, value }) => (
        <div className="flex items-center gap-3 py-2 border-b border-gray-100">
            <Icon className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 w-32">{label}</span>
            <span className="text-sm font-medium text-gray-800">{value || '-'}</span>
        </div>
    );

    const getStatusColor = (status) => {
        const map = {
            Actif: 'bg-green-100 text-green-800',
            'Congé': 'bg-orange-100 text-orange-800',
            Suspendu: 'bg-red-100 text-red-800',
        };
        return map[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusLabel = (status) => {
        const map = { Actif: 'Actif', 'Congé': 'Congé', Suspendu: 'Suspendu', Autre: 'Autre' };
        return map[status] || status;
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-end" />
                    <span>{t('personnel.viewDetails')}</span>
                </div>
            }
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={600}
        >
            <div className="py-4">
                {/* En-tete avec photo et nom */}
                <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary-end to-primary-start rounded-lg text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">{personnel.nom} {personnel.prenom}</h3>
                        <p className="text-white/80">{personnel.matricule}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(personnel.statut)}`}>
                            {getStatusLabel(personnel.statut)}
                        </span>
                    </div>
                </div>

                {/* Informations */}
                <div className="space-y-1">
                    <InfoRow icon={Briefcase} label={t('personnel.position')} value={t(`personnel.positions.${personnel.poste}`)} />
                    <InfoRow icon={Mail} label={t('personnel.email')} value={personnel.email} />
                    <InfoRow icon={Phone} label={t('personnel.phone')} value={personnel.contact} />
                    <InfoRow icon={Building2} label={t('personnel.service')} value={personnel.service_nom} />
                    <InfoRow icon={Calendar} label={t('personnel.birthDate')} value={personnel.date_naissance} />
                    <InfoRow icon={Calendar} label={t('personnel.hireDate')} value={personnel.date_joined?.split('T')[0]} />
                    {personnel.adresse && (
                        <InfoRow icon={User} label={t('personnel.address')} value={personnel.adresse} />
                    )}
                    {personnel.specialite && (
                        <InfoRow icon={Briefcase} label="Spécialité" value={personnel.specialite} />
                    )}
                </div>
                {onManagePrimes && (
                    <div className="mt-4 pt-4 border-t">
                        <button type="button" onClick={() => onManagePrimes(personnel)}
                            className="text-sm text-primary-end font-medium hover:underline">
                            Gérer les primes multi-services
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
