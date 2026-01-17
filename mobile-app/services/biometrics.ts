import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

interface BiometricCredentials {
  email: string;
  token: string;
}

class BiometricService {
  /**
   * Check if the device has biometric hardware
   */
  async hasHardware(): Promise<boolean> {
    return await LocalAuthentication.hasHardwareAsync();
  }

  /**
   * Check if biometrics are enrolled on the device
   */
  async isEnrolled(): Promise<boolean> {
    return await LocalAuthentication.isEnrolledAsync();
  }

  /**
   * Get the type of biometric authentication available
   */
  async getBiometricType(): Promise<BiometricType> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'facial';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'iris';
    }
    return 'none';
  }

  /**
   * Get a human-readable name for the biometric type
   */
  async getBiometricName(): Promise<string> {
    const type = await this.getBiometricType();

    if (Platform.OS === 'ios') {
      return type === 'facial' ? 'Face ID' : 'Touch ID';
    }

    switch (type) {
      case 'facial':
        return 'Face Recognition';
      case 'fingerprint':
        return 'Fingerprint';
      case 'iris':
        return 'Iris Scanner';
      default:
        return 'Biometrics';
    }
  }

  /**
   * Check if biometric login is available (hardware + enrolled + enabled by user)
   */
  async isAvailable(): Promise<boolean> {
    const hasHardware = await this.hasHardware();
    const isEnrolled = await this.isEnrolled();
    return hasHardware && isEnrolled;
  }

  /**
   * Authenticate using biometrics
   */
  async authenticate(promptMessage?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const biometricName = await this.getBiometricName();

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Login with ${biometricName}`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow passcode fallback
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        return { success: true };
      }

      // Handle different error cases
      if (result.error === 'user_cancel') {
        return { success: false, error: 'Authentication cancelled' };
      }
      if (result.error === 'user_fallback') {
        return { success: false, error: 'User chose passcode fallback' };
      }
      if (result.error === 'system_cancel') {
        return { success: false, error: 'System cancelled authentication' };
      }
      if (result.error === 'not_enrolled') {
        return { success: false, error: 'No biometrics enrolled' };
      }
      if (result.error === 'lockout') {
        return { success: false, error: 'Too many attempts. Try again later.' };
      }

      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: 'Authentication error occurred' };
    }
  }

  /**
   * Check if biometric login is enabled for this app
   */
  async isBiometricLoginEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enable biometric login and store credentials
   */
  async enableBiometricLogin(email: string, token: string): Promise<boolean> {
    try {
      // First verify the user can authenticate
      const authResult = await this.authenticate('Verify your identity to enable biometric login');

      if (!authResult.success) {
        return false;
      }

      // Store credentials securely
      const credentials: BiometricCredentials = { email, token };
      await SecureStore.setItemAsync(
        BIOMETRIC_CREDENTIALS_KEY,
        JSON.stringify(credentials),
        {
          keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        }
      );

      // Mark biometric login as enabled
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      return true;
    } catch (error) {
      console.error('Failed to enable biometric login:', error);
      return false;
    }
  }

  /**
   * Disable biometric login and clear stored credentials
   */
  async disableBiometricLogin(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.error('Failed to disable biometric login:', error);
    }
  }

  /**
   * Attempt to login using stored biometric credentials
   */
  async loginWithBiometrics(): Promise<{ success: boolean; credentials?: BiometricCredentials; error?: string }> {
    try {
      // Check if biometric login is enabled
      const isEnabled = await this.isBiometricLoginEnabled();
      if (!isEnabled) {
        return { success: false, error: 'Biometric login not enabled' };
      }

      // Authenticate
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Retrieve stored credentials
      const credentialsJson = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!credentialsJson) {
        return { success: false, error: 'No stored credentials found' };
      }

      const credentials: BiometricCredentials = JSON.parse(credentialsJson);
      return { success: true, credentials };
    } catch (error) {
      console.error('Biometric login error:', error);
      return { success: false, error: 'Failed to retrieve credentials' };
    }
  }

  /**
   * Update stored token (e.g., after token refresh)
   */
  async updateStoredToken(newToken: string): Promise<boolean> {
    try {
      const credentialsJson = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!credentialsJson) {
        return false;
      }

      const credentials: BiometricCredentials = JSON.parse(credentialsJson);
      credentials.token = newToken;

      await SecureStore.setItemAsync(
        BIOMETRIC_CREDENTIALS_KEY,
        JSON.stringify(credentials),
        {
          keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to update stored token:', error);
      return false;
    }
  }

  /**
   * Get the stored email (for display purposes)
   */
  async getStoredEmail(): Promise<string | null> {
    try {
      const credentialsJson = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!credentialsJson) {
        return null;
      }
      const credentials: BiometricCredentials = JSON.parse(credentialsJson);
      return credentials.email;
    } catch {
      return null;
    }
  }
}

export const biometricService = new BiometricService();
export default biometricService;
