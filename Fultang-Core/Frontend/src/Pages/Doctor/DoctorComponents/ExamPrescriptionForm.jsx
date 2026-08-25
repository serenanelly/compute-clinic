import  { useState } from 'react';
import { Search, User, ChevronDown,Plus, Trash2, FileText } from 'lucide-react';
import {Users, Calendar, ClipboardList, Pill,Stethoscope} from 'lucide-react';
import {DashBoard} from "../../../GlobalComponents/DashBoard.jsx";
import {links} from "../Doctor.jsx";


// Mock data for patients
const patients = [
  { id: 1, name: "Jean Dupont", age: 45, email: "jean@email.com", phone: "0123456789" },
  { id: 2, name: "Marie Martin", age: 32, email: "marie@email.com", phone: "0123456788" },
  { id: 3, name: "Pierre Durant", age: 28, email: "pierre@email.com", phone: "0123456787" },
];

export const ExamPrescriptionForm2 = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchPatient, setSearchPatient] = useState('');
  const [formData, setFormData] = useState({
    examDetails: '',
    examStatus: 'en_attente',
    notes: '',
  });
  const [exams, setExams] = useState([{ type: '', details: '' }]);

  const filteredPatients = patients.filter(patient =>
      patient.name.toLowerCase().includes(searchPatient.toLowerCase())
  );

  const addExam = () => {
    setExams([...exams, { type: '', details: '' }]);
  };

  const removeExam = (index) => {
    const newExams = exams.filter((_, i) => i !== index);
    setExams(newExams);
  };

  const updateExam = (index, field, value) => {
    const newExams = exams.map((exam, i) => {
      if (i === index) {
        return { ...exam, [field]: value };
      }
      return exam;
    });
    setExams(newExams);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const prescriptionData = {
      ...formData,
      exams,
      patientId: selectedPatient.id,
      // Autres champs qui seraient normalement gérés par le backend
      addDate: new Date().toISOString(),
      idMedicalFolderPage: 1, // À remplacer par la vraie valeur
      idMedicalStaff: 1, // À remplacer par la vraie valeur
    };
    console.log('Prescription d\'examens soumise:', prescriptionData);
    // Ici, vous ajouteriez la logique pour envoyer les données au serveur
  };

  if (!selectedPatient) {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-green-700" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
                Prescription d&#39;Examens Médicaux
              </h1>
              <p className="text-center text-gray-600 mb-8">
                Sélectionnez un patient pour commencer la prescription
              </p>

              <div className="bg-white rounded-xl">
                <div className="relative mb-4">
                  <input
                      type="text"
                      placeholder="Rechercher un patient..."
                      value={searchPatient}
                      onChange={(e) => setSearchPatient(e.target.value)}
                      className="w-full px-4 py-3 pl-12 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                  />
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                </div>

                <div className="mt-4 max-h-96 overflow-y-auto">
                  {filteredPatients.map(patient => (
                      <button
                          key={patient.id}
                          onClick={() => setSelectedPatient(patient)}
                          className="w-full p-4 flex items-center space-x-4 hover:bg-green-50 rounded-lg transition-all group"
                      >
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-all">
                          <User className="w-6 h-6 text-green-700" />
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-medium text-gray-800">{patient.name}</h3>
                          <div className="text-sm text-gray-500 space-x-4">
                            <span>{patient.age} ans</span>
                            <span>•</span>
                            <span>{patient.phone}</span>
                          </div>
                        </div>
                      </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-green-100">
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
            <h1 className="text-3xl font-bold">
              Prescription d&#39;Examens Médicaux
            </h1>
          </div>
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-gray-800">
                Prescription d&#39;Examens Médicaux
              </h1>
              <button
                  onClick={() => setSelectedPatient(null)}
                  className="text-green-700 hover:text-green-800 transition-colors"
              >
                <ChevronDown size={24} />
              </button>
            </div>

            <div className="mb-8 p-6 bg-green-50 rounded-xl">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-green-700" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-800">
                    {selectedPatient.name}
                  </h2>
                  <div className="text-sm text-gray-600 space-x-4">
                    <span>{selectedPatient.age} ans</span>
                    <span>•</span>
                    <span>{selectedPatient.phone}</span>
                    <span>•</span>
                    <span>{selectedPatient.email}</span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                <div>
                  <label htmlFor="examDetails" className="block text-sm font-medium text-gray-700 mb-1">
                    Détails de l&#39;examen
                  </label>
                  <textarea
                      id="examDetails"
                      name="examDetails"
                      value={formData.examDetails}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                      placeholder="Entrez les détails de l'examen ici..."
                  />
                </div>
                <div>
                  <label htmlFor="examStatus" className="block text-sm font-medium text-gray-700 mb-1">
                    Statut de l&#39;examen
                  </label>
                  <select
                      id="examStatus"
                      name="examStatus"
                      value={formData.examStatus}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                  >
                    <option value="en_attente">En attente</option>
                    <option value="en_cours">En cours</option>
                    <option value="effectue">Effectué</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes du médecin
                  </label>
                  <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                      placeholder="Ajoutez vos notes ici..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800">
                  Examens prescrits
                </h3>
                {exams.map((exam, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-md bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`exam-type-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Type d&#39;examen
                          </label>
                          <input
                              type="text"
                              id={`exam-type-${index}`}
                              value={exam.type}
                              onChange={(e) => updateExam(index, 'type', e.target.value)}
                              className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                              required
                          />
                        </div>
                        <div>
                          <label htmlFor={`exam-details-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                            Détails de l&#39;examen
                          </label>
                          <textarea
                              id={`exam-details-${index}`}
                              value={exam.details}
                              onChange={(e) => updateExam(index, 'details', e.target.value)}
                              rows={3}
                              className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                          />
                        </div>
                      </div>
                      {exams.length > 1 && (
                          <button
                              type="button"
                              onClick={() => removeExam(index)}
                              className="mt-2 text-red-500 hover:text-red-700 focus:outline-none"
                              aria-label="Supprimer cet examen"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                      )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addExam}
                    className="mt-2 flex items-center text-green-700 hover:text-green-800 focus:outline-none"
                >
                  <Plus className="h-5 w-5 mr-1" />
                  Ajouter un examen
                </button>
              </div>

              <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center"
              >
                <FileText className="mr-2" />
                Soumettre la prescription d&#39;examens
              </button>
            </form>
          </div>
        </div>
      </div>
  );
}





export default function ExamPrescriptionForm()
{
  return(
      <DashBoard linkList={links} requiredRole="doctor">
        <ExamPrescriptionForm2></ExamPrescriptionForm2>
      </DashBoard>
  )
}