import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/components/AuthProvider';

// Mock del módulo de Supabase
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: jest.fn().mockReturnValue(true),
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: any) => {
        mockOnAuthStateChange(callback);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn()
            }
          }
        };
      }
    }
  }
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('proporciona contexto de autenticación vacío cuando no hay sesión', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    mockOnAuthStateChange.mockImplementation((callback) => {
      // Simular el evento INITIAL_SESSION sin sesión
      setTimeout(() => callback('INITIAL_SESSION', null), 0);
    });

    const TestComponent = () => {
      const { session, user, loading } = useAuth();
      
      return (
        <div>
          <span data-testid="session">{session ? 'has-session' : 'no-session'}</span>
          <span data-testid="user">{user ? 'has-user' : 'no-user'}</span>
          <span data-testid="loading">{loading ? 'loading' : 'loaded'}</span>
        </div>
      );
    };

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').textContent).toBe('loaded');
    });

    expect(getByTestId('session').textContent).toBe('no-session');
    expect(getByTestId('user').textContent).toBe('no-user');
  });

  it('proporciona información de sesión cuando existe', async () => {
    const mockSession = {
      user: {
        id: 'user-id',
        email: 'test@example.com'
      },
      expires_at: new Date().toISOString()
    };

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    mockOnAuthStateChange.mockImplementation((callback) => {
      // Simular el evento INITIAL_SESSION con sesión
      setTimeout(() => callback('INITIAL_SESSION', mockSession), 0);
    });

    const TestComponent = () => {
      const { session, user, loading } = useAuth();
      
      return (
        <div>
          <span data-testid="session">{session ? 'has-session' : 'no-session'}</span>
          <span data-testid="user-id">{user?.id || 'no-user-id'}</span>
          <span data-testid="loading">{loading ? 'loading' : 'loaded'}</span>
        </div>
      );
    };

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').textContent).toBe('loaded');
    });

    expect(getByTestId('session').textContent).toBe('has-session');
    expect(getByTestId('user-id').textContent).toBe('user-id');
  });

  it('usa initialUser cuando se proporciona', async () => {
    const initialUser = {
      id: 'initial-user-id',
      email: 'initial@example.com'
    };

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    mockOnAuthStateChange.mockImplementation((callback) => {
      setTimeout(() => callback('INITIAL_SESSION', null), 0);
    });

    const TestComponent = () => {
      const { user } = useAuth();
      
      return (
        <div>
          <span data-testid="user-id">{user?.id || 'no-user-id'}</span>
        </div>
      );
    };

    const { getByTestId } = render(
      <AuthProvider initialUser={initialUser as any}>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('user-id').textContent).toBe('initial-user-id');
    });
  });
});