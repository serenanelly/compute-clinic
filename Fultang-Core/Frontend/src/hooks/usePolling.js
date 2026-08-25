import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Compare deux valeurs pour determiner si elles sont egales.
 * Utilise JSON.stringify pour une comparaison profonde.
 */
export function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

/**
 * Hook pour le polling intelligent des données.
 * Ne met à jour l'état QUE si les données ont changé.
 * 
 * @param {Function} fetchFunction - Fonction async qui retourne les nouvelles données
 * @param {number} intervalMs - Intervalle de polling en millisecondes (défaut: 5000 = 5s)
 * @param {boolean} enabled - Active/désactive le polling (défaut: true)
 * @returns {Object} { data, isLoading, error, refresh }
 * 
 * @example
 * const { data, isLoading } = useSmartPolling(
 *   async () => {
 *     const response = await fetchPatients();
 *     return response.data;
 *   },
 *   5000
 * );
 */
export function useSmartPolling(fetchFunction, intervalMs = 5000, enabled = true) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const previousDataRef = useRef(null);
    const intervalRef = useRef(null);
    const isMountedRef = useRef(true);

    const fetchAndCompare = useCallback(async () => {
        if (!fetchFunction) return;

        try {
            const newData = await fetchFunction();

            // Ne mettre à jour que si les données ont changé
            if (!deepEqual(previousDataRef.current, newData)) {
                if (isMountedRef.current) {
                    previousDataRef.current = newData;
                    setData(newData);
                }
            }

            if (isMountedRef.current) {
                setError(null);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err);
            }
        }
    }, [fetchFunction]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        await fetchAndCompare();
        if (isMountedRef.current) {
            setIsLoading(false);
        }
    }, [fetchAndCompare]);

    useEffect(() => {
        isMountedRef.current = true;

        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Fetch initial
        refresh();

        // Démarrer le polling silencieux (sans setIsLoading)
        intervalRef.current = setInterval(fetchAndCompare, intervalMs);

        return () => {
            isMountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, intervalMs, fetchAndCompare, refresh]);

    return { data, isLoading, error, refresh };
}

/**
 * Hook simplifié pour auto-refresh avec comparaison intelligente.
 * Ne déclenche un re-render QUE si les données ont changé.
 * 
 * @param {Function} callback - Fonction async du composant qui fait setData
 * @param {Function} getData - Fonction qui retourne les données actuelles
 * @param {number} delay - Délai en ms entre chaque appel (défaut: 5000)
 * @param {boolean} enabled - Active le polling (défaut: true)
 */
export function useAutoRefresh(callback, delay = 5000, enabled = true) {
    const savedCallback = useRef(callback);
    const intervalRef = useRef(null);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Configurer l'intervalle pour le polling silencieux
        intervalRef.current = setInterval(() => {
            savedCallback.current();
        }, delay);

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [delay, enabled]);
}

/**
 * Fonction utilitaire pour mettre à jour l'état seulement si les données ont changé.
 * À utiliser dans les composants avec useAutoRefresh.
 * 
 * @param {any} newData - Nouvelles données
 * @param {any} currentData - Données actuelles
 * @param {Function} setData - Fonction setState
 * @returns {boolean} - true si les données ont été mises à jour
 */
export function updateIfChanged(newData, currentData, setData) {
    if (!deepEqual(currentData, newData)) {
        setData(newData);
        return true;
    }
    return false;
}

// Re-export WebSocket hooks for convenience
export { useWebSocket, useRealtimeData, WS_STATE } from './useWebSocket';

export default useSmartPolling;
