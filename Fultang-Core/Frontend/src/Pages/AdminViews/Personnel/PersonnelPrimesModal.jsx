import { useState, useEffect } from 'react';
import { Modal, message, Table, Button } from 'antd';
import { getPrimes, createPrime, deletePrime } from '../../../services/primesApi';
import { getServiceId } from '../../../constants/personnelPostes.js';

/**
 * Gestion des primes multi-services pour un membre du personnel (CORR-A5-008).
 */
export function PersonnelPrimesModal({ isOpen, onClose, personnel, services = [] }) {
    const [primes, setPrimes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ service: '', montant_fcfa: '', motif: '', date_debut: '', date_fin: '' });

    useEffect(() => {
        if (isOpen && personnel?.id) {
            loadPrimes();
        }
    }, [isOpen, personnel?.id]);

    const loadPrimes = async () => {
        setLoading(true);
        try {
            const data = await getPrimes({ personnel_id: personnel.id });
            setPrimes(Array.isArray(data) ? data : []);
        } catch {
            message.error('Erreur chargement des primes');
            setPrimes([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!form.service || !form.montant_fcfa || !form.date_debut) {
            message.warning('Service, montant et date de début sont obligatoires');
            return;
        }
        try {
            await createPrime({
                personnel_id: personnel.id,
                service: parseInt(form.service, 10),
                montant_fcfa: parseFloat(form.montant_fcfa),
                motif: form.motif || '',
                date_debut: form.date_debut,
                ...(form.date_fin ? { date_fin: form.date_fin } : {}),
            });
            message.success('Prime enregistrée');
            setForm({ service: '', montant_fcfa: '', motif: '', date_debut: '', date_fin: '' });
            loadPrimes();
        } catch (error) {
            message.error(error.response?.data?.detail || 'Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deletePrime(id);
            message.success('Prime supprimée');
            loadPrimes();
        } catch {
            message.error('Suppression impossible');
        }
    };

    if (!personnel) return null;

    return (
        <Modal
            title={`Primes — ${personnel.nom} ${personnel.prenom || ''}`}
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={720}
        >
            <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                    <select value={form.service} onChange={(e) => setForm(f => ({ ...f, service: e.target.value }))}
                        className="px-3 py-2 border rounded-lg">
                        <option value="">Service *</option>
                        {services.map(s => (
                            <option key={getServiceId(s)} value={getServiceId(s)}>{s.nom_service}</option>
                        ))}
                    </select>
                    <input type="number" placeholder="Montant FCFA *" value={form.montant_fcfa}
                        onChange={(e) => setForm(f => ({ ...f, montant_fcfa: e.target.value }))}
                        className="px-3 py-2 border rounded-lg" />
                    <input type="date" value={form.date_debut}
                        onChange={(e) => setForm(f => ({ ...f, date_debut: e.target.value }))}
                        className="px-3 py-2 border rounded-lg" />
                    <input type="date" placeholder="Date fin (opt.)" value={form.date_fin}
                        onChange={(e) => setForm(f => ({ ...f, date_fin: e.target.value }))}
                        className="px-3 py-2 border rounded-lg" />
                    <input type="text" placeholder="Motif" value={form.motif}
                        onChange={(e) => setForm(f => ({ ...f, motif: e.target.value }))}
                        className="col-span-2 px-3 py-2 border rounded-lg" />
                </div>
                <Button type="primary" onClick={handleAdd}>Ajouter une prime</Button>

                <Table
                    size="small"
                    loading={loading}
                    dataSource={primes}
                    rowKey="id_prime"
                    pagination={false}
                    columns={[
                        { title: 'Service', dataIndex: 'service_nom', key: 'service_nom' },
                        { title: 'Montant', dataIndex: 'montant_fcfa', key: 'montant_fcfa', render: v => `${Number(v).toLocaleString('fr-FR')} FCFA` },
                        { title: 'Début', dataIndex: 'date_debut', key: 'date_debut' },
                        { title: 'Fin', dataIndex: 'date_fin', key: 'date_fin', render: v => v || '—' },
                        {
                            title: '', key: 'actions', render: (_, r) => (
                                <Button danger size="small" onClick={() => handleDelete(r.id_prime)}>Suppr.</Button>
                            ),
                        },
                    ]}
                />
            </div>
        </Modal>
    );
}
