export type AuthMode = 'login' | 'register' | 'code' | 'email-login' | 'reset' | 'recovery';
export type AuthState = { mode: AuthMode; pending: boolean; message: string | null; signupCode: boolean };
export const initialAuthState: AuthState = { mode: 'login', pending: false, message: null, signupCode: true };
export type AuthAction = { type: 'mode'; mode: AuthMode } | { type: 'pending' }
  | { type: 'done'; message: string; code?: boolean } | { type: 'error'; message: string } | { type: 'signed-out' };
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'mode': return { ...state, mode: action.mode, message: null };
    case 'pending': return { ...state, pending: true, message: null };
    case 'done': return { ...state, pending: false, message: action.message,
      ...(action.code === undefined ? {} : { mode: 'code', signupCode: action.code }) };
    case 'error': return { ...state, pending: false, message: action.message };
    case 'signed-out': return initialAuthState;
  }
}
