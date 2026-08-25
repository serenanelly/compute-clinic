import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * WebSocket connection states
 */
export const WS_STATE = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

/**
 * Get WebSocket URL based on current environment
 */
function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use backend URL from environment or default to localhost:8000
    const host = import.meta.env.VITE_WS_HOST || 'localhost:8000';
    return `${protocol}//${host}/ws/updates/`;
}

/**
 * Hook for managing WebSocket connection with auto-reconnect.
 * 
 * @param {Function} onMessage - Callback when a message is received
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether to enable the connection (default: true)
 * @param {number} options.reconnectInterval - Reconnect interval in ms (default: 3000)
 * @param {number} options.maxRetries - Max reconnection attempts (default: 5)
 * @returns {Object} { connectionState, sendMessage, subscribe }
 * 
 * @example
 * const { connectionState, subscribe } = useWebSocket((message) => {
 *   if (message.model === 'patient') {
 *     refetchPatients();
 *   }
 * });
 */
export function useWebSocket(onMessage, options = {}) {
    const {
        enabled = true,
        reconnectInterval = 3000,
        maxRetries = 5
    } = options;

    const [connectionState, setConnectionState] = useState(WS_STATE.DISCONNECTED);
    const wsRef = useRef(null);
    const retriesRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const onMessageRef = useRef(onMessage);

    // Keep callback ref updated
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnectionState(WS_STATE.CONNECTING);

        try {
            const ws = new WebSocket(getWebSocketUrl());

            ws.onopen = () => {
                setConnectionState(WS_STATE.CONNECTED);
                retriesRef.current = 0;
                console.log('[WebSocket] Connected to real-time updates');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (onMessageRef.current && data.type === 'model_update') {
                        onMessageRef.current(data);
                    }
                } catch (error) {
                    console.error('[WebSocket] Error parsing message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[WebSocket] Connection error:', error);
                setConnectionState(WS_STATE.ERROR);
            };

            ws.onclose = (event) => {
                setConnectionState(WS_STATE.DISCONNECTED);
                wsRef.current = null;

                // Attempt reconnection if not a clean close
                if (enabled && retriesRef.current < maxRetries) {
                    retriesRef.current += 1;
                    console.log(`[WebSocket] Reconnecting... (attempt ${retriesRef.current}/${maxRetries})`);
                    reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
                } else if (retriesRef.current >= maxRetries) {
                    console.log('[WebSocket] Max retries reached, giving up');
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('[WebSocket] Failed to create connection:', error);
            setConnectionState(WS_STATE.ERROR);
        }
    }, [enabled, reconnectInterval, maxRetries]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnectionState(WS_STATE.DISCONNECTED);
    }, []);

    const sendMessage = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
            return true;
        }
        return false;
    }, []);

    const subscribe = useCallback((groups) => {
        return sendMessage({
            type: 'subscribe',
            groups: Array.isArray(groups) ? groups : [groups]
        });
    }, [sendMessage]);

    // Connect on mount, disconnect on unmount
    useEffect(() => {
        if (enabled) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return {
        connectionState,
        isConnected: connectionState === WS_STATE.CONNECTED,
        sendMessage,
        subscribe,
        reconnect: connect
    };
}

/**
 * Hook for real-time data that combines initial fetch with WebSocket updates.
 * 
 * @param {Function} fetchFunction - Async function to fetch data
 * @param {string} modelName - Model name to listen for (e.g., 'patient')
 * @param {Object} options - Additional options
 * @returns {Object} { data, isLoading, error, refetch, isConnected }
 * 
 * @example
 * const { data: patients, isLoading, isConnected } = useRealtimeData(
 *   () => getAllPatients(),
 *   'patient'
 * );
 */
export function useRealtimeData(fetchFunction, modelName, options = {}) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await fetchFunction();
            const responseData = result?.data || result?.results || result || [];
            setData(responseData);
            setError(null);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFunction]);

    // Handle WebSocket messages
    const handleMessage = useCallback((message) => {
        if (message.model === modelName) {
            console.log(`[WebSocket] ${modelName} ${message.action}:`, message.id);
            // Refetch data when model changes
            fetchData();
        }
    }, [modelName, fetchData]);

    const { isConnected, connectionState } = useWebSocket(handleMessage, options);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        isLoading,
        error,
        refetch: fetchData,
        isConnected,
        connectionState
    };
}

export default useWebSocket;
