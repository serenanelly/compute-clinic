import React, { useState } from 'react';
import { Modal, Button, Form, Input, message, Divider } from 'antd';
import { FaLock, FaQuestionCircle, FaUserCog } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/personnelApi';

export function SettingsModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const handlePasswordChange = async (values) => {
        setLoading(true);
        try {
            await changePassword({
                old_password: values.currentPassword,
                new_password: values.newPassword,
                confirm_password: values.confirmPassword
            });
            message.success('Mot de passe modifié avec succès');
            form.resetFields();
            onClose();
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || "Erreur lors du changement de mot de passe";
            message.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const navigateToHelpCenter = () => {
        onClose();
        navigate('/help-center');
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-xl text-secondary">
                    <FaUserCog /> Paramètres Utilisateur
                </div>
            }
            open={isOpen}
            onCancel={onClose}
            footer={null}
            destroyOnHidden
        >
            <div className="space-y-6">
                {/* Section Sécurité */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <FaLock /> Sécurité
                    </h3>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handlePasswordChange}
                    >
                        <Form.Item
                            name="currentPassword"
                            label="Mot de passe actuel"
                            rules={[{ required: true, message: 'Veuillez entrer votre mot de passe actuel' }]}
                        >
                            <Input.Password placeholder="Votre mot de passe actuel" />
                        </Form.Item>

                        <Form.Item
                            name="newPassword"
                            label="Nouveau mot de passe"
                            rules={[
                                { required: true, message: 'Veuillez entrer un nouveau mot de passe' },
                                { min: 8, message: 'Le mot de passe doit contenir au moins 8 caractères' }
                            ]}
                        >
                            <Input.Password placeholder="Nouveau mot de passe" />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            label="Confirmer le nouveau mot de passe"
                            dependencies={['newPassword']}
                            rules={[
                                { required: true, message: 'Veuillez confirmer votre mot de passe' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('newPassword') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Les mots de passe ne correspondent pas'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password placeholder="Confirmez le nouveau mot de passe" />
                        </Form.Item>

                        <Form.Item className="mb-0 flex justify-end">
                            <Button type="primary" htmlType="submit" loading={loading} className="bg-blue-600">
                                Changer le mot de passe
                            </Button>
                        </Form.Item>
                    </Form>
                </div>

                <Divider />

                {/* Section Aide */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <FaQuestionCircle /> Aide & Support
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Besoin d'aide ? Consultez notre centre d'aide pour trouver des réponses à vos questions.
                    </p>
                    <Button
                        block
                        onClick={navigateToHelpCenter}
                        className="flex items-center justify-center gap-2"
                    >
                        Accéder au Centre d'Aide
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default SettingsModal;
