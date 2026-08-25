import {useCallback, useState} from 'react';
import {

  Search, User, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import {DashBoard} from "../../../GlobalComponents/DashBoard.jsx";
import {links} from "../Doctor.jsx";




/// Mock data for patients and exam results
const patients = [
  { id: 1, name: "Jean Dupont", age: 45, email: "jean@email.com", phone: "0123456789" },
  { id: 2, name: "Marie Martin", age: 32, email: "marie@email.com", phone: "0123456788" },
  { id: 3, name: "Pierre Durant", age: 28, email: "pierre@email.com", phone: "0123456787" },
];

const examData = [
  {
    id: 1,
    patientId: 1,
    name: "Bilan sanguin",
    date: "2023-05-15",
    status: "available",
    results: "Globules rouges: 4.5 M/µL\nGlobules blancs: 7.5 K/µL\nPlaquettes: 250 K/µL",
    doctorNotes: "Résultats dans la norme. Aucune anomalie détectée.",
    addedDate: "2023-05-17",
    examRequestId: "ER001",
    medicalFileId: "MF001",
    doctorId: "DR001"
  },
  {
    id: 2,
    patientId: 1,
    name: "Radiographie pulmonaire",
    date: "2023-05-20",
    status: "pending",
    results: "",
    doctorNotes: "",
    addedDate: "",
    examRequestId: "ER002",
    medicalFileId: "MF001",
    doctorId: "DR002"
  },
  {
    id: 3,
    patientId: 2,
    name: "Test d'allergie",
    date: "2023-05-18",
    status: "available",
    results: "Positif pour les arachides et le pollen",
    doctorNotes: "Recommandation d'éviter les arachides et de prendre des antihistaminiques pendant la saison pollinique.",
    addedDate: "2023-05-19",
    examRequestId: "ER003",
    medicalFileId: "MF002",
    doctorId: "DR003"
  },
];



export const ExamResults2 = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [expandedExam, setExpandedExam] = useState(null);
  const [searchPatient, setSearchPatient] = useState('');

  const toggleExam = useCallback((id) => {
    setExpandedExam(prevId => prevId === id ? null : id);
  }, []);

  const filteredPatients = patients.filter(patient =>
      patient.name.toLowerCase().includes(searchPatient.toLowerCase())
  );

  const patientExams = selectedPatient
      ? examData.filter(exam => exam.patientId === selectedPatient.id)
      : [];

  if (!selectedPatient) {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-green-700" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
                Résultats d&#39;Examens
              </h1>
              <p className="text-center text-gray-600 mb-8">
                Sélectionnez un patient pour voir ses résultats d&#39;examens
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-gray-800">
                Résultats d&#39;Examens
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

            {patientExams.length === 0 ? (
                <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md mb-6 flex items-start">
                  <AlertCircle className="mr-2 flex-shrink-0 mt-1" />
                  <p>Aucun examen n&#39;a été prescrit pour ce patient.</p>
                </div>
            ) : (
                <div className="space-y-4">
                  {patientExams.map((exam) => (
                      <div key={exam.id} className="border border-gray-200 rounded-md overflow-hidden">
                        <button
                            onClick={() => toggleExam(exam.id)}
                            className="w-full p-4 text-left bg-white hover:bg-green-50 transition-colors flex justify-between items-center"
                        >
                          <span className="font-medium text-gray-800">{exam.name} - {exam.date}</span>
                          {expandedExam === exam.id ? <ChevronUp className="text-green-700" /> : <ChevronDown className="text-green-700" />}
                        </button>
                        {expandedExam === exam.id && (
                            <div className="p-4 bg-white">
                              <h3 className="font-semibold mb-2">Notes du médecin :</h3>
                              <p className="text-gray-700">{exam.doctorNotes}</p>
                              <p className="text-sm text-gray-500 mt-4">Date d&#39;ajout : {exam.addedDate}</p>
                            </div>
                        )}
                      </div>
                  ))}
                </div>
            )}
          </div>
        </div>
      </div>
  );
}

export default ExamResults;


export function ExamResults() {
  return (
      <DashBoard linkList={links} requiredRole="doctor">
        <ExamResults2 />
      </DashBoard>
  )
}