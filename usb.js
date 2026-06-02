// Universal Auto-Storage Bridge - Deep Nested Relay Edition (usb.js)
const StorageBridge = (() => {
    const MAGIC_TOKEN = "AUTOBRIDGE_SIGNAL";
    
    // 1. DYNAMICALLY LOCATE THE TRUE OS STORAGE HOST
    // We look up the window chain to see who is running the StorageBridge host controller.
    let isHost = true;
    let targetStorageWindow = window;

    // Search upwards to find if there's a parent window hosting the storage controller
    let currentWindow = window;
    while (currentWindow.parent && currentWindow.parent !== currentWindow) {
        currentWindow = currentWindow.parent;
        // If a higher window is identified as a host candidate, we route messages there
        isHost = false;
        targetStorageWindow = currentWindow;
    }

    // --- HOST CONTROLLER (Always binds to the absolute top-most context loading the script) ---
    if (isHost) {
        window.addEventListener("message", (event) => {
            if (!event.data || typeof event.data !== 'object' || event.data.bridgeToken !== MAGIC_TOKEN) return;
            
            const { action, key, value, requestId } = event.data;
            const sourceWindow = event.source; 
            if (!sourceWindow) return;

            let result = null;
            let error = null;

            try {
                if (action === "GET") result = localStorage.getItem(key);
                else if (action === "SET") { localStorage.setItem(key, value); result = true; }
                else if (action === "REMOVE") { localStorage.removeItem(key); result = true; }
                else if (action === "CLEAR") { localStorage.clear(); result = true; }
            } catch (err) {
                error = err.message;
            }

            sourceWindow.postMessage({ bridgeToken: MAGIC_TOKEN, requestId, result, error }, "*");
        });
    }

    // --- CLIENT APPLICATION REGISTRY ---
    const pendingRequests = new Map();
    if (!isHost) {
        window.addEventListener("message", (event) => {
            if (!event.data || typeof event.data !== 'object' || event.data.bridgeToken !== MAGIC_TOKEN) return;
            
            const { requestId, result, error } = event.data;
            const callback = pendingRequests.get(requestId);
            if (callback) {
                pendingRequests.delete(requestId);
                if (error) callback.reject(new Error(error));
                else callback.resolve(result);
            }
        });
    }

    const sendRequest = (action, key = null, value = null) => {
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(2, 15);
            pendingRequests.set(requestId, { resolve, reject });
            
            // Route directly to the top-most window context found on boot
            targetStorageWindow.postMessage({ bridgeToken: MAGIC_TOKEN, requestId, action, key, value }, "*");
        });
    };

    return {
        get: (key) => !isHost ? sendRequest("GET", key) : localStorage.getItem(key),
        set: (key, value) => !isHost ? sendRequest("SET", key, value) : localStorage.setItem(key, value),
        remove: (key) => !isHost ? sendRequest("REMOVE", key) : localStorage.removeItem(key),
        clear: () => !isHost ? sendRequest("CLEAR") : localStorage.clear()
    };
})();
