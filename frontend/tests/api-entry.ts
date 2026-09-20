// Bundled with Vite for Node's built-in test runner: exercises production modules,
// without introducing a separate test bundler or connecting to the live backend.
export { ApiError, apiRequest } from '../src/api/client';
export { login, register, getCurrentUser, logout } from '../src/api/auth';
export { apiEndpoints } from '../src/api/endpoints';
export { normalizeRoles, getPrimaryRole, getWorkspaceCopy } from '../src/utils/roles';
