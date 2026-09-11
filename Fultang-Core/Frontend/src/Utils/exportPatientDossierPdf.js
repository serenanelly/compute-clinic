import jsPDF from 'jspdf';
import { APP_NAME, brandFooter } from '../constants/branding.js';

const MARGIN = 14;
const PAGE_BOTTOM = 275;
const CONTENT_WIDTH = 182;

function formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ensureSpace(doc, y, needed = 8) {
    if (y + needed > PAGE_BOTTOM) {
        doc.addPage();
        return MARGIN + 10;
    }
    return y;
}

function addSectionTitle(doc, title, y) {
    y = ensureSpace(doc, y, 12);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(26, 115, 163);
    doc.text(title, MARGIN, y);
    doc.setDrawColor(80, 194, 185);
    doc.line(MARGIN, y + 2, MARGIN + CONTENT_WIDTH, y + 2);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    return y + 8;
}

function addWrappedText(doc, text, y, indent = 0) {
    const lines = doc.splitTextToSize(String(text || '—'), CONTENT_WIDTH - indent);
    doc.setFontSize(9);
    lines.forEach((line) => {
        y = ensureSpace(doc, y, 5);
        doc.text(line, MARGIN + indent, y);
        y += 5;
    });
    return y;
}

function addLabelValue(doc, label, value, y) {
    y = ensureSpace(doc, y, 6);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`${label} :`, MARGIN, y);
    doc.setFont(undefined, 'normal');
    return addWrappedText(doc, value, y, 38);
}

function getMaladies(patientData) {
    const list = patientData?.maladies_chroniques || patientData?.maladies || [];
    if (!list.length) return 'Aucune';
    return list.map((m) => m.nom || m.libelle || m.description).filter(Boolean).join(', ');
}

function getAllergies(patientData) {
    const list = patientData?.allergies || [];
    if (!list.length) return 'Aucune';
    return list.map((a) => a.declencheur || a.nom).filter(Boolean).join(', ');
}

function getAntecedents(patientData) {
    const list = patientData?.antecedents || [];
    if (!list.length) return 'Aucun';
    return list.map((a) => a.description || a.nom).filter(Boolean).join(' ; ');
}

function getGroupeSanguin(dc) {
    if (!dc?.groupe_sanguin) return 'Non spécifié';
    const rh = dc.facteur_rhesus === 'POSITIF' ? '+' : dc.facteur_rhesus === 'NEGATIF' ? '-' : '';
    return `${dc.groupe_sanguin}${rh}`.trim();
}

function safeFilenamePart(value) {
    return String(value || 'patient')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40);
}

/**
 * Génère et télécharge le dossier patient au format PDF.
 */
export function downloadPatientDossierPdf(patientData, visites = []) {
    if (!patientData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const dc = patientData.donnees_cliniques || {};
    const fullName = `${patientData.nom || ''} ${patientData.prenom || ''}`.trim() || 'Patient';

    doc.setFontSize(16);
    doc.setTextColor(26, 115, 163);
    doc.text('Dossier médical patient', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`${APP_NAME} — ${fullName}`, pageWidth / 2, 26, { align: 'center' });
    doc.text(`Généré le ${formatDate(new Date().toISOString())}`, pageWidth / 2, 32, { align: 'center' });

    let y = 42;

    y = addSectionTitle(doc, 'Identité', y);
    y = addLabelValue(doc, 'Nom complet', fullName, y);
    y = addLabelValue(doc, 'Matricule', patientData.matricule || patientData.id?.substring(0, 8), y);
    y = addLabelValue(doc, 'Sexe', patientData.sexe || '—', y);
    y = addLabelValue(doc, 'Âge', patientData.age != null ? `${patientData.age} ans` : '—', y);
    y = addLabelValue(doc, 'Profession', patientData.profession || '—', y);
    y = addLabelValue(doc, 'Date de naissance', patientData.date_naissance ? formatDate(patientData.date_naissance) : '—', y);

    y = addSectionTitle(doc, 'Constantes vitales', y);
    y = addLabelValue(doc, 'Poids', dc.poids ? `${dc.poids} kg` : '—', y);
    y = addLabelValue(doc, 'Taille', dc.taille ? `${dc.taille} cm` : '—', y);
    y = addLabelValue(doc, 'Tension', dc.tension_arterielle ? `${dc.tension_arterielle} mmHg` : '—', y);
    y = addLabelValue(doc, 'Température', dc.temperature ? `${dc.temperature} °C` : '—', y);
    y = addLabelValue(doc, 'Pouls', dc.pouls ? `${dc.pouls} bpm` : '—', y);
    y = addLabelValue(doc, 'SpO₂', dc.taux_oxygene ? `${dc.taux_oxygene} %` : '—', y);
    y = addLabelValue(doc, 'Groupe sanguin', getGroupeSanguin(dc), y);
    y = addLabelValue(doc, 'Électrophorèse Hb', dc.electrophorese_hb || '—', y);

    y = addSectionTitle(doc, 'Antécédents & allergies', y);
    y = addLabelValue(doc, 'Allergies', getAllergies(patientData), y);
    y = addLabelValue(doc, 'Maladies chroniques', getMaladies(patientData), y);
    y = addLabelValue(doc, 'Antécédents', getAntecedents(patientData), y);

    y = addSectionTitle(doc, 'Historique des visites', y);

    if (!visites.length) {
        y = addWrappedText(doc, 'Aucune visite enregistrée.', y);
    } else {
        visites
            .slice()
            .sort((a, b) => new Date(b.date_heure || 0) - new Date(a.date_heure || 0))
            .forEach((visite) => {
                y = ensureSpace(doc, y, 14);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(9);
                y = addWrappedText(doc, `Visite du ${formatDate(visite.date_heure)} — ${visite.statut || '—'}`, y);
                doc.setFont(undefined, 'normal');
                y = addWrappedText(doc, `Motif : ${visite.motif_visite || '—'}`, y);

                const consultations = visite.consultations || [];
                if (!consultations.length) {
                    y = addWrappedText(doc, 'Aucune consultation détaillée.', y, 4);
                } else {
                    consultations.forEach((consult) => {
                        if (consult.examen_physique?.trim()) {
                            y = addWrappedText(doc, `Examen physique : ${consult.examen_physique}`, y, 4);
                        }
                        if (consult.diagnostics?.length) {
                            const diags = consult.diagnostics.map((d) => d.libelle).filter(Boolean).join(', ');
                            y = addWrappedText(doc, `Diagnostics : ${diags}`, y, 4);
                        }
                        if (consult.prescriptions?.length) {
                            const meds = consult.prescriptions
                                .map((p) => `${p.nom || p.medicament || 'Médicament'} (${p.posologie || '—'})`)
                                .join(' ; ');
                            y = addWrappedText(doc, `Prescriptions : ${meds}`, y, 4);
                        }
                        if (consult.examens?.length) {
                            const exams = consult.examens
                                .map((e) => e.nom || e.nom_examen || 'Examen')
                                .join(', ');
                            y = addWrappedText(doc, `Examens prescrits : ${exams}`, y, 4);
                        }
                    });
                }
                y += 3;
            });
    }

    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(brandFooter('Dossier médical'), pageWidth / 2, footerY, { align: 'center' });

    const filename = `dossier_${safeFilenamePart(patientData.nom)}_${safeFilenamePart(patientData.prenom)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
}
