const getApiUrls = () => {
  return ['https://family-tree-lica.onrender.com/api'];
};


const API_URLS = getApiUrls();
let cachedWorkingBaseUrl = null;

const apiFetch = async (path, options = {}) => {
  const urlsToTry = [...API_URLS];
  if (cachedWorkingBaseUrl) {
    const idx = urlsToTry.indexOf(cachedWorkingBaseUrl);
    if (idx > -1) {
      urlsToTry.splice(idx, 1);
      urlsToTry.unshift(cachedWorkingBaseUrl);
    }
  }

  // Inject skip anti-spam header to prevent devtunnel warning page from blocking requests
  const requestHeaders = {
    ...(options.headers || {}),
    'X-Tunnel-Skip-AntiSpam': 'true'
  };
  const requestOptions = {
    ...options,
    headers: requestHeaders
  };

  let lastError = null;
  for (const baseUrl of urlsToTry) {
    try {
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, requestOptions);
      // Save working URL if response resolved (even if error status, route is alive)
      cachedWorkingBaseUrl = baseUrl;
      return res;
    } catch (err) {
      console.warn(`Failed to connect to ${baseUrl}${path}, trying fallback...`, err);
      lastError = err;
    }
  }
  throw lastError || new Error('Network error: All backend links are unreachable');
};

let authToken = null;

const getHeaders = () => {
  const token = authToken;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const getHeadersForUpload = () => {
  const token = authToken;
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res) => {
  if (res.status === 401) {
    authToken = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-unauthorized'));
    }
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
};

export const api = {
  setToken: (token) => {
    authToken = token;
  },
  getToken: () => {
    return authToken;
  },
  getBaseUrl: () => {
    return cachedWorkingBaseUrl || API_URLS[0];
  },
  // Auth endpoints
  auth: {
    register: async (email, password) => {
      const res = await apiFetch(`/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(res);
    },
    login: async (email, password) => {
      const res = await apiFetch(`/auth/login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(res);
    },
    getMe: async () => {
      const res = await apiFetch(`/auth/me`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    googleLogin: async (credential) => {
      const res = await apiFetch(`/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ credential }),
      });
      return handleResponse(res);
    },
    firebaseLogin: async (firebaseToken) => {
      const res = await apiFetch(`/auth/firebase-login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ firebaseToken }),
      });
      return handleResponse(res);
    },
    updateProfile: async (profile, syncSettings) => {
      const res = await apiFetch(`/auth/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ profile, syncSettings }),
      });
      return handleResponse(res);
    },
    logout: async () => {
      const res = await apiFetch(`/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    uploadProfilePicture: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiFetch(`/auth/upload`, {
        method: 'POST',
        headers: getHeadersForUpload(),
        body: formData,
      });
      return handleResponse(res);
    },
  },

  // Tree endpoints
  trees: {
    list: async () => {
      const res = await apiFetch(`/trees`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    get: async (id) => {
      const res = await apiFetch(`/trees/${id}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    create: async (treeName) => {
      const res = await apiFetch(`/trees`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ treeName }),
      });
      return handleResponse(res);
    },
    delete: async (id) => {
      const res = await apiFetch(`/trees/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    manageRole: async (treeId, email, role, nodeId) => {
      const res = await apiFetch(`/trees/${treeId}/roles`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, role, nodeId }),
      });
      return handleResponse(res);
    },
    joinRequest: async (treeId) => {
      const res = await apiFetch(`/trees/join`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ treeId }),
      });
      return handleResponse(res);
    },
    listJoinRequests: async (treeId) => {
      const res = await apiFetch(`/trees/${treeId}/join-requests`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    approveJoinRequest: async (treeId, requestId, nodeId) => {
      const res = await apiFetch(`/trees/${treeId}/join-requests/${requestId}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nodeId }),
      });
      return handleResponse(res);
    },
    rejectJoinRequest: async (treeId, requestId) => {
      const res = await apiFetch(`/trees/${treeId}/join-requests/${requestId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    listMembers: async (treeId) => {
      const res = await apiFetch(`/trees/${treeId}/members`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },

  // Kinship graph & validation endpoints
  kinship: {
    getGraph: async (treeId, centerNodeId = null, depth = null) => {
      let path = `/kinship/${treeId}/graph`;
      const queries = [];
      if (centerNodeId) queries.push(`centerNodeId=${centerNodeId}`);
      if (depth) queries.push(`depth=${depth}`);
      if (queries.length > 0) {
        path += `?${queries.join('&')}`;
      }
      const res = await apiFetch(path, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    createNode: async (treeId, nodeData) => {
      const res = await apiFetch(`/kinship/${treeId}/nodes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(nodeData),
      });
      return handleResponse(res);
    },
    createSpouse: async (treeId, spouseData) => {
      const res = await apiFetch(`/kinship/${treeId}/nodes/spouse`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(spouseData),
      });
      return handleResponse(res);
    },
    createMarriage: async (treeId, nodeAId, nodeBId) => {
      const res = await apiFetch(`/kinship/${treeId}/edges/marriage`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nodeAId, nodeBId }),
      });
      return handleResponse(res);
    },
    createParentChild: async (treeId, parentId, childId) => {
      const res = await apiFetch(`/kinship/${treeId}/edges/parent-child`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ parentId, childId }),
      });
      return handleResponse(res);
    },
    updateNode: async (treeId, nodeId, nodeData) => {
      const res = await apiFetch(`/kinship/${treeId}/nodes/${nodeId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(nodeData),
      });
      return handleResponse(res);
    },
    deleteNode: async (treeId, nodeId) => {
      const res = await apiFetch(`/kinship/${treeId}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    deleteEdge: async (treeId, sourceNodeId, targetNodeId, relationshipType) => {
      const res = await apiFetch(`/kinship/${treeId}/edges`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ sourceNodeId, targetNodeId, relationshipType }),
      });
      return handleResponse(res);
    },
    getRelation: async (treeId, sourceId, targetId) => {
      const res = await apiFetch(`/kinship/${treeId}/relation?sourceId=${sourceId}&targetId=${targetId}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    uploadImage: async (treeId, file) => {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiFetch(`/kinship/${treeId}/upload`, {
        method: 'POST',
        headers: getHeadersForUpload(),
        body: formData,
      });
      return handleResponse(res);
    },
    getNodeTree: async (nodeId) => {
      const res = await apiFetch(`/kinship/nodes/${nodeId}/tree`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    getLogs: async (treeId) => {
      const res = await apiFetch(`/kinship/${treeId}/logs`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    revertLog: async (treeId, logId) => {
      const res = await apiFetch(`/kinship/${treeId}/logs/${logId}/revert`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    getNotifications: async (treeId) => {
      const res = await apiFetch(`/kinship/${treeId}/notifications`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    markNotificationRead: async (treeId, notificationId) => {
      const res = await apiFetch(`/kinship/${treeId}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    markAllNotificationsRead: async (treeId) => {
      const res = await apiFetch(`/kinship/${treeId}/notifications/read-all`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },
  // Super Admin endpoints
  superadmin: {
    listTrees: async () => {
      const res = await apiFetch(`/superadmin/trees`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    reassignAdmin: async (treeId, newAdminEmail) => {
      const res = await apiFetch(`/superadmin/reassign-admin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ treeId, newAdminEmail }),
      });
      return handleResponse(res);
    },
    deleteTree: async (treeId) => {
      const res = await apiFetch(`/superadmin/trees/${treeId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },
};
