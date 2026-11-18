import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { Mail, Sparkles } from 'lucide-react-native';
import { getSupabase, requireSupabase, authRedirect } from '@/lib/supabase';
import { authReducer, initialAuthState, type AuthMode } from '@/lib/auth-state';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const AuthContext = createContext<{ session: Session | null; loading: boolean; recovery: boolean; error: string | null }>({ session: null, loading: true, recovery: false, error: null });
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true), [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const client = getSupabase();
    if (!client) { setLoading(false); return; }
    let live = true, revision = 0;
    client.auth.getSession().then(({ data, error }) => {
      if (!live || revision) return;
      setSession(data.session); setLoading(false); if (error) setError(error.message);
    }).catch(() => { if (live) { setLoading(false); setError('Could not restore your sign-in. Please retry.'); } });
    const { data } = client.auth.onAuthStateChange((event, value) => {
      revision++; setSession(value); setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setRecovery(false);
    });
    const link = async (url: string) => {
      if (Platform.OS === 'web' || !config.scheme) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== `${config.scheme}:` || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return;
        const query = new URLSearchParams(parsed.search || parsed.hash.slice(1));
        const code = query.get('code');
        if (code) { const result = await client.auth.exchangeCodeForSession(code); if (result.error) throw result.error; }
        else {
          const access_token = query.get('access_token'), refresh_token = query.get('refresh_token');
          if (access_token && refresh_token) { const result = await client.auth.setSession({ access_token, refresh_token }); if (result.error) throw result.error; }
        }
        if (query.get('type') === 'recovery') setRecovery(true);
      } catch { if (live) setError('This sign-in link could not be used. Request a new email.'); }
    };
    void Linking.getInitialURL().then(url => { if (url && live) void link(url); });
    const links = Linking.addEventListener('url', event => { void link(event.url); });
    const activity = AppState.addEventListener('change', state => { if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); });
    return () => { live = false; data.subscription.unsubscribe(); links.remove(); activity.remove(); client.auth.stopAutoRefresh(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, recovery, error }}>{children}</AuthContext.Provider>;
}

// What each mode says: a heading, one line under it and the primary button.
const copy: Record<AuthMode, { title: string; description: string; action: string }> = {
  login: { title: 'Welcome back', description: 'Sign in to continue to your account.', action: 'Sign in' },
  register: { title: 'Create your account', description: 'It takes less than a minute.', action: 'Create account' },
  code: { title: 'Check your email', description: 'Enter the code from your email.', action: 'Verify' },
  'email-login': { title: 'Sign in with a code', description: 'We’ll email you a code, so you can sign in without a password.', action: 'Send code' },
  reset: { title: 'Reset your password', description: 'Enter the email you signed up with. We’ll send you a link to choose a new password.', action: 'Send reset link' },
  recovery: { title: 'Set a new password', description: 'Choose a new password for your account.', action: 'Update password' },
};

/** A sentence with a link at its end, such as "Don’t have an account? Sign up". */
function LinkRow({ text, action, disabled, onPress }: { text: string; action: string; disabled?: boolean; onPress: () => void }) {
  return (
    <View className="flex-row flex-wrap items-center justify-center">
      <Text className="text-muted-foreground text-sm">{text}</Text>
      <Button variant="link" size="sm" className="h-11 px-1.5" disabled={disabled} onPress={onPress}>
        <Text className="text-foreground text-sm font-medium underline">{action}</Text>
      </Button>
    </View>
  );
}

export function AccountGate({ children, initialMode = 'login' }: { children: ReactNode; initialMode?: AuthMode }) {
  const auth = useAuth();
  const [state, dispatch] = useReducer(authReducer, { ...initialAuthState, mode: initialMode });
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const mode = auth.recovery ? 'recovery' : state.mode;
  async function run(resend = false) {
    if (state.pending) return;
    dispatch({ type: 'pending' });
    try {
      const { auth } = requireSupabase();
      let result: { error: { message: string } | null }, message = '', nextCode: boolean | undefined;
      if (resend) {
        result = state.signupCode ? await auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirect() } })
          : await auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect(), shouldCreateUser: false } });
        message = 'Email requested. Use the most recent code or link.';
      } else if (mode === 'register') {
        const signup = await auth.signUp({ email, password, options: { emailRedirectTo: authRedirect() } }); result = signup;
        if (!signup.data.session) nextCode = true;
        message = 'Check your email to finish signing up.';
      } else if (mode === 'code') {
        const verified = await auth.verifyOtp({ email, token: code.trim(), type: 'email' }); result = verified;
        if (!verified.error && !verified.data.session) throw new Error('Request a new code and try again.');
        message = 'Email verified.';
      } else if (mode === 'email-login') {
        result = await auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect(), shouldCreateUser: false } }); nextCode = false;
        message = 'If this address can sign in, you will receive an email.';
      } else if (mode === 'reset') {
        result = await auth.resetPasswordForEmail(email, { redirectTo: authRedirect() }); message = 'If this address has an account, you will receive a reset email.';
      } else if (mode === 'recovery') { result = await auth.updateUser({ password }); message = 'Password updated.'; }
      else { result = await auth.signInWithPassword({ email, password }); message = 'Signed in.'; }
      if (result.error) throw result.error;
      setPassword(''); dispatch({ type: 'done', message, code: nextCode });
    } catch (error) { dispatch({ type: 'error', message: error instanceof Error ? error.message : 'Could not finish. Check your connection and retry.' }); }
  }
  if (auth.loading) return <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-center text-sm">Restoring your sign-in…</Text>;
  if (auth.session && !auth.recovery) return <>{children}</>;
  const { title, description, action } = copy[mode];
  const centered = mode === 'login' || mode === 'code';
  const go = (next: AuthMode) => () => dispatch({ type: 'mode', mode: next });
  const primary = (
    <Button className="w-full" disabled={state.pending} onPress={() => void run()}>
      <Text className="text-base">{state.pending ? 'Working…' : action}</Text>
    </Button>
  );
  // What the last request answered. The sign-in provider's own failures are errors; the form's
  // answers (including Supabase's) come back as one message without a severity.
  const feedback = state.message ? (
    <Text role="status" accessibilityLiveRegion="polite" className="text-sm">{state.message}</Text>
  ) : auth.error ? (
    <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-sm">{auth.error}</Text>
  ) : null;
  return (
    <View className="flex-1 gap-8">
      <View className="gap-8">
        <View className={cn('gap-1.5', centered && 'items-center')}>
          {mode === 'login' ? (
            <View className="bg-primary mb-[18px] size-12 items-center justify-center rounded-2xl">
              <Icon as={Sparkles} className="text-primary-foreground size-[22px]" />
            </View>
          ) : null}
          {mode === 'code' ? (
            <View className="bg-muted mb-[18px] size-16 items-center justify-center rounded-full">
              <Icon as={Mail} className="size-7" />
            </View>
          ) : null}
          <Text role="heading" className={cn('text-2xl font-semibold tracking-tight', centered && 'text-center')}>{title}</Text>
          <Text className={cn('text-muted-foreground text-sm', centered && 'text-center')}>
            {mode === 'code' && email ? (
              <>We sent a code to{'\n'}<Text className="text-foreground text-sm font-medium">{email}</Text></>
            ) : description}
          </Text>
        </View>

        <FieldGroup>
          {mode !== 'recovery' && mode !== 'code' ? (
            <Field>
              <FieldLabel nativeID="email">Email</FieldLabel>
              <Input aria-labelledby="email" placeholder="m@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!state.pending} />
            </Field>
          ) : null}
          {['login', 'register', 'recovery'].includes(mode) ? (
            <Field>
              {mode === 'login' ? (
                <View className="flex-row items-center justify-between">
                  <FieldLabel nativeID="password">Password</FieldLabel>
                  <Button variant="link" size="sm" className="h-auto px-0 py-0" hitSlop={10} disabled={state.pending} onPress={go('reset')}>
                    <Text className="text-muted-foreground text-sm font-normal">Forgot password?</Text>
                  </Button>
                </View>
              ) : (
                <FieldLabel nativeID="password">{mode === 'recovery' ? 'New password' : 'Password'}</FieldLabel>
              )}
              <Input
                aria-labelledby="password"
                placeholder={mode === 'login' ? 'Your password' : mode === 'recovery' ? 'Choose a new password' : 'Create a password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                editable={!state.pending}
              />
            </Field>
          ) : null}
          {mode === 'code' ? (
            <>
              <Input aria-label="Email code" placeholder="Code" className="text-center text-lg tracking-widest" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" editable={!state.pending} />
              <LinkRow text="Didn’t get it?" action="Resend email" disabled={state.pending} onPress={() => void run(true)} />
            </>
          ) : null}
          {feedback}
          {mode === 'login' ? (
            <>
              <View className="pt-1">{primary}</View>
              <View className="flex-row items-center gap-3">
                <Separator className="w-auto flex-1" />
                <Text className="text-muted-foreground text-sm">or</Text>
                <Separator className="w-auto flex-1" />
              </View>
              <Button variant="outline" className="w-full" disabled={state.pending} onPress={go('email-login')}>
                <Icon as={Mail} className="size-4" />
                <Text className="text-base">Email me a sign-in code</Text>
              </Button>
            </>
          ) : null}
        </FieldGroup>
      </View>

      <View className="mt-auto gap-2">
        {mode === 'login' ? <LinkRow text="Don’t have an account?" action="Sign up" disabled={state.pending} onPress={go('register')} /> : primary}
        {mode === 'register' ? <LinkRow text="Already have an account?" action="Sign in" disabled={state.pending} onPress={go('login')} /> : null}
        {mode === 'code' ? (
          <Button variant="ghost" className="w-full" disabled={state.pending} onPress={go(state.signupCode ? 'register' : 'email-login')}>
            <Text className="text-base">Use a different email</Text>
          </Button>
        ) : null}
        {mode === 'email-login' || mode === 'reset' ? (
          <Button variant="ghost" className="w-full" disabled={state.pending} onPress={go('login')}>
            <Text className="text-base">Back to sign in</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

export function AccountActions() {
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  async function act(remove: boolean) {
    if (pending) return; setPending(true); setError(null);
    try {
      const client = requireSupabase();
      if (remove) { const result = await client.functions.invoke('delete-account'); if (result.error) throw result.error; }
      const result = await client.auth.signOut(remove ? { scope: 'local' } : undefined); if (result.error) throw result.error;
    } catch { setError('This action did not finish. Check your connection and retry.'); }
    finally { setPending(false); }
  }
  return (
    <View className="gap-2">
      {error ? <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-center text-sm">{error}</Text> : null}
      <Button variant="outline" className="h-11 w-full" disabled={pending} onPress={() => void act(false)}>
        <Text className="text-[15px]">Sign out</Text>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="h-11 w-full" disabled={pending}>
            <Text className="text-destructive text-[15px]">Delete account</Text>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>Your account and application data will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>Keep account</Text></AlertDialogCancel>
            <AlertDialogAction onPress={() => void act(true)}><Text>Delete account</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
