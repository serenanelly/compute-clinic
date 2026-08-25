import { useNavigate } from 'react-router-dom';
import ChatWindow from './ChatWindow.jsx';

/**
 * Contenu du centre d'aide (réutilisable dans le layout caissier ou en page standalone).
 */
export function HelpCenterContent({ showBack = true }) {
  const navigate = useNavigate();

  return (
    <div className="pb-8">
      {showBack && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-800 hover:text-blue-900 mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour
        </button>
      )}

      <div className="mb-8">
        <input
          type="text"
          placeholder="Rechercher dans l'aide..."
          className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-800"
        />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Catégories d&apos;aide</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-medium mb-2">Encaissement & quittances</h3>
            <p className="text-gray-600 text-sm">Recherche patient, fiche d&apos;encaissement, modes de paiement.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-medium mb-2">Caisse journalière</h3>
            <p className="text-gray-600 text-sm">Ouverture, fermeture, dépenses menues, écart de caisse.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-medium mb-2">Décaissements</h3>
            <p className="text-gray-600 text-sm">Exécution des ordres de paiement approuvés.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-medium mb-2">FAQ</h3>
            <p className="text-gray-600 text-sm">Réponses aux questions fréquentes du guichet.</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Articles populaires</h2>
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-base font-medium">Comment encaisser un patient walk-in ?</h3>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-base font-medium">Pourquoi le solde d&apos;ouverture est-il verrouillé ?</h3>
            <p className="text-sm text-slate-500 mt-1">
              Il reprend automatiquement le montant compté à la fermeture précédente pour limiter la fraude.
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-base font-medium">Où voir les décaissements dans l&apos;historique ?</h3>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Support</h2>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-medium mb-4">Nous contacter</h3>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <select className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Choisir un sujet</option>
              <option>Problème technique</option>
              <option>Caisse / encaissement</option>
              <option>Autre</option>
            </select>
            <textarea
              placeholder="Décrivez votre problème..."
              className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
            <button
              type="submit"
              className="bg-primary-start text-white px-6 py-2 rounded-lg hover:opacity-90"
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>

      <ChatWindow />
    </div>
  );
}
