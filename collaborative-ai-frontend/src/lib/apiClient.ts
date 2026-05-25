function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
}

function handleUnauthorized() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
    }
}

async function request(endpoint: string, options: RequestInit = {}) {
    const token = getToken();
    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return null;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
    }

    return response.json();
}

export const apiClient = {
    async get(endpoint: string) {
        try {
            return await request(endpoint, { method: 'GET' });
        } catch (error) {
            console.error('API Client GET Error:', error);
            return null;
        }
    },

    async post<T = unknown>(endpoint: string, body: T) {
        try {
            return await request(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });
        } catch (error) {
            console.error('API Client POST Error:', error);
            throw error;
        }
    },

    async patch<T = unknown>(endpoint: string, body: T) {
        try {
            return await request(endpoint, {
                method: 'PATCH',
                body: JSON.stringify(body)
            });
        } catch (error) {
            console.error('API Client PATCH Error:', error);
            throw error;
        }
    },

    async delete(endpoint: string) {
        try {
            return await request(endpoint, { method: 'DELETE' });
        } catch (error) {
            console.error('API Client DELETE Error:', error);
            throw error;
        }
    }
};
