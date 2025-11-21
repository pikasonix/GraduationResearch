// Minimal backend client wrapper for frontend app
// Provides db, auth, storage helpers that call your separate backend API.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function apiRequest(path, options = {}) {
    const res = await fetch(path, {
        credentials: 'include',
        headers: { ...(options.headers || {}) },
        ...options,
    });
    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (e) { payload = text; }
    if (!res.ok) return { data: null, error: payload || res.statusText };
    return { data: payload, error: null };
}

export const db = {
    async select(table, query = {}) {
        const qs = new URLSearchParams(query).toString();
        return apiRequest(`/api/db/${encodeURIComponent(table)}${qs ? '?' + qs : ''}`);
    },
    async insert(table, body) {
        return apiRequest(`/api/db/${encodeURIComponent(table)}`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(body),
        });
    },
    async update(table, id, body) {
        return apiRequest(`/api/db/${encodeURIComponent(table)}/${id}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify(body),
        });
    },
    async remove(table, id) {
        return apiRequest(`/api/db/${encodeURIComponent(table)}/${id}`, {
            method: 'DELETE',
        });
    }
};

export const auth = {
    async session() { return apiRequest('/api/auth/session'); },
    async signOut() { return apiRequest('/api/auth/signout', { method: 'POST' }); },
    oauthRedirect(provider) { window.location.href = `/api/auth/oauth/${provider}`; },
};

export const storage = {
    async upload({ bucket, path, file }) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', bucket);
        fd.append('path', path);
        return apiRequest('/api/storage/upload', { method: 'POST', body: fd });
    },
    async download(url) {
        return apiRequest(url);
    }
};

export default { db, auth, storage };
