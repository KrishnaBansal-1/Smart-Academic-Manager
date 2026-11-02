import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { apiClient } from '../api/client';

describe('Reload at Root & Auth Navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user visiting / to /login', async () => {
    window.history.pushState({}, 'Test', '/');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('keeps authenticated admin on dashboard and does not bounce to /login during reload', async () => {
    localStorage.setItem('sam_access_token', 'valid-admin-token');
    localStorage.setItem(
      'sam_user',
      JSON.stringify({
        id: 'admin-1',
        _id: 'admin-1',
        email: 'admin@sam.edu',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      })
    );

    // Mock apiClient.get for /auth/me
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/auth/me') {
        return {
          data: {
            success: true,
            data: {
              user: {
                id: 'admin-1',
                _id: 'admin-1',
                email: 'admin@sam.edu',
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN',
              },
            },
          },
        } as never;
      }
      return { data: { data: { items: [] } } } as never;
    });

    window.history.pushState({}, 'Test', '/');

    render(<App />);

    await waitFor(() => {
      // Admin dashboard is loaded, not login page
      expect(screen.getByText(/welcome back, admin!/i)).toBeInTheDocument();
    });
  });
});
