import { useEffect, useState, useCallback } from 'react';
import { biometricService, BiometricType } from '@/services/biometrics';

interface UseBiometricsResult {
  isAvailable: boolean;
  isEnabled: boolean;
  biometricType: BiometricType;
  biometricName: string;
  storedEmail: string | null;
  loading: boolean;
  enable: (email: string, token: string) => Promise<boolean>;
  disable: () => Promise<void>;
  authenticate: (prompt?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometrics: () => Promise<{ success: boolean; credentials?: { email: string; token: string }; error?: string }>;
  refresh: () => Promise<void>;
}

export function useBiometrics(): UseBiometricsResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [biometricName, setBiometricName] = useState('Biometrics');
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const [available, enabled, type, name, email] = await Promise.all([
        biometricService.isAvailable(),
        biometricService.isBiometricLoginEnabled(),
        biometricService.getBiometricType(),
        biometricService.getBiometricName(),
        biometricService.getStoredEmail(),
      ]);

      setIsAvailable(available);
      setIsEnabled(enabled);
      setBiometricType(type);
      setBiometricName(name);
      setStoredEmail(email);
    } catch (error) {
      console.error('Failed to check biometric status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const enable = useCallback(async (email: string, token: string): Promise<boolean> => {
    const success = await biometricService.enableBiometricLogin(email, token);
    if (success) {
      setIsEnabled(true);
      setStoredEmail(email);
    }
    return success;
  }, []);

  const disable = useCallback(async (): Promise<void> => {
    await biometricService.disableBiometricLogin();
    setIsEnabled(false);
    setStoredEmail(null);
  }, []);

  const authenticate = useCallback(async (prompt?: string) => {
    return await biometricService.authenticate(prompt);
  }, []);

  const loginWithBiometrics = useCallback(async () => {
    return await biometricService.loginWithBiometrics();
  }, []);

  return {
    isAvailable,
    isEnabled,
    biometricType,
    biometricName,
    storedEmail,
    loading,
    enable,
    disable,
    authenticate,
    loginWithBiometrics,
    refresh: checkStatus,
  };
}

export default useBiometrics;
