import { useState, useEffect } from 'react';
import { Modal, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Stethoscope } from 'lucide-react';
import { getServicePersonnel, getServiceMedecins } from '../../../services/servicesApi';
import StatCard from '../../../GlobalComponents/StatCard';

/**
 * Modal affichant les statistiques et details d'un service.
 * Montre le personnel et les medecins du service.
 */
export function ServiceStatsModal({ isOpen, onClose, service }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [personnel, setPersonnel] = useState([]);
    const [medecins, setMedecins] = useState([]);

    useEffect(() => {
        if (service && isOpen) {
            fetchStats();
        }
    }, [service, isOpen]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const [personnelRes, medecinsRes] = await Promise.all([
                getServicePersonnel(service.id),
                getServiceMedecins(service.id)
            ]);
            setPersonnel(personnelRes.data || []);
            setMedecins(medecinsRes.data || []);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const personnelColumns = [
        { title: t('services.lastName'), dataIndex: 'nom', key: 'nom' },
        { title: t('services.firstName'), dataIndex: 'prenom', key: 'prenom' },
        { title: t('services.email'), dataIndex: 'email', key: 'email' },
        { title: t('services.position'), dataIndex: 'poste', key: 'poste' }
    ];

    const medecinColumns = [
        { title: t('services.lastName'), dataIndex: 'nom', key: 'nom' },
        { title: t('services.firstName'), dataIndex: 'prenom', key: 'prenom' },
        { title: t('services.specialty'), dataIndex: 'specialite', key: 'specialite' },
        { title: t('services.email'), dataIndex: 'email', key: 'email' }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary-end" />
                    <span>{t('services.stats.serviceDetails')} - {service?.nom_service}</span>
                </div>
            }
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={900}
        >
            <div className="space-y-6 py-4">
                {/* Informations du service */}
                <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">{service?.nom_service}</h4>
                    <p className="text-gray-600 text-sm">{service?.desc_service || '-'}</p>
                    {service?.chef_service_details && (
                        <p className="text-sm mt-2">
                            <span className="font-medium">{t('services.chefService')}:</span>{' '}
                            {service.chef_service_details.nom} {service.chef_service_details.prenom}
                        </p>
                    )}
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 gap-4">
                    <StatCard
                        icon={Users}
                        title={t('services.stats.totalPersonnel')}
                        value={personnel.length}
                        description={t('services.personnel')}
                        color="bg-blue-500"
                    />
                    <StatCard
                        icon={Stethoscope}
                        title={t('services.stats.totalDoctors')}
                        value={medecins.length}
                        description={t('services.positions.medecin')}
                        color="bg-green-500"
                    />
                </div>

                {/* Liste du personnel */}
                <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {t('services.stats.personnelList')}
                    </h4>
                    <Table
                        columns={personnelColumns}
                        dataSource={personnel}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 5 }}
                        size="small"
                        locale={{ emptyText: t('services.stats.noPersonnel') }}
                    />
                </div>

                {/* Liste des medecins */}
                <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Stethoscope className="w-4 h-4" />
                        {t('services.stats.doctorsList')}
                    </h4>
                    <Table
                        columns={medecinColumns}
                        dataSource={medecins}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 5 }}
                        size="small"
                        locale={{ emptyText: t('services.stats.noDoctors') }}
                    />
                </div>
            </div>
        </Modal>
    );
}
