import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { importSPKI, jwtVerify, type JWTPayload } from 'jose';
import apiService from '@/lib/api-service';
import { getBrowserInfo, getFingerprintId } from '@/lib/utils';
import { SKIP_JWT_VERIFICATION, decodeJwtPayload } from '@/lib/api-stubs';

// Constants
const JWT_STORAGE_KEY = 'auth_jwt';

const getTokenExpiryFromExp = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadPart = parts[1];
    if (!payloadPart) return null;

    const payloadBase64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = payloadBase64.padEnd(Math.ceil(payloadBase64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(paddedPayload)) as { exp?: number };

    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

// Location interface that matches the JWT structure
export interface Location {
  location_type: 'registered_location' | 'device_location' | 'agristack_location';
  district: string;
  village: string;
  taluka: string;
  lgd_code: string;
}

// User interface that contains the essential user information
export interface User {
  authenticated: boolean;
  username: string;
  email: string;
  mobile: string;
  is_guest_user?: boolean;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  locations: Location[];
  isLoading: boolean;
  login: (_username: string, _password: string) => Promise<boolean>;
  logout: () => void;
  setAuthToken: (_token: string) => Promise<boolean>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  locations: [],
  isLoading: true,
  login: async () => false,
  logout: () => {},
  setAuthToken: async () => false,
});

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component that will wrap the application
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);

  // Keep this in sync with bharat-oan-api/jwt_public_key.pem.
  const publicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoiAT5pkWCk7KgBXDFO6C
FHo1fmVMUHOCDXJ1EcAb11REiSHgxlP9TPLCs8qPSe5eeJAHGn9sqB0p0jC8cWzh
RvnrCqRhNXhmOyqrCTudBT8ePnMYU7H/dpoqF1zpYctDVkaYOf0l/H+uWk55f+Zy
zZVcpQAi2lTwNQP2teIHqt4YNsOKmX9J2BvczRj4wdCpp84+UkFJ+lVftHbEoxYM
OnCObibmuJDPvwrkHtACJZFy1Dc371evaaTN3dGE/P7MLXRA+XtInY5lYfsB23/Q
a37S+srKe59wFypSMOU+ZMvgFA2oK0zA1WEC93000n5HEQMJU8r7pCgKhq7oD8QJ
hwIDAQAB
-----END PUBLIC KEY-----`;

  // Fetch new JWT token from /api/token and store it
  const fetchAndStoreNewToken = useCallback(async (importedPublicKey: CryptoKey | null) => {
    try {
      // Get browser info to send as meta parameter
      const browserInfo = getBrowserInfo();
      const fingerprintId = await getFingerprintId();
      
      // Call /api/token to get JWT token
      const newToken = await apiService.fetchAuthToken(browserInfo, fingerprintId);
      
      // Validate and store the new token
      if (importedPublicKey) {
        const result = await validateJWT(newToken, importedPublicKey);
        if (result.isValid) {
          storeJWT(newToken);
          createUserFromPayload(result.payload);
        } else {
          console.error('Received invalid token from /api/token');
        }
      } else {
        // If public key is not available, store token anyway
        storeJWT(newToken);
        // Create a basic authenticated user
        // We might want to decode the token even without verification to get user details
        // but for now, we'll create a default guest user if verification fails/is impossible
        // Ideally we should decode here even if we can't verify signature if we trust the source channel
        setUser({
          username: 'Guest User',
          email: '',
          mobile: '',
          authenticated: true,
          is_guest_user: true,
        });
      }
    } catch (error) {
      console.error('Failed to fetch auth token from /api/token:', error);
    }
  }, []);

  // Initialize auth state on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        // Import the public key
        const importedPublicKey = await importSPKI(publicKeyPEM, 'RS256');
        setPublicKey(importedPublicKey);

        // Check URL params first for new JWT
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');

        // If JWT exists in URL, validate and store it
        if (tokenFromUrl) {
          if (importedPublicKey) {
            const result = await validateJWT(tokenFromUrl, importedPublicKey);
            if (result.isValid) {
              storeJWT(tokenFromUrl);
              createUserFromPayload(result.payload);
              // Clean up URL by removing the JWT parameter
              const newUrl = window.location.pathname + window.location.hash;
              window.history.replaceState({}, document.title, newUrl);
            } else {
              console.error('JWT verification failed for URL token');
              // createUserFromPayload(null); // Instead of null, fetch guest token
              await fetchAndStoreNewToken(importedPublicKey);
            }
          } else {
               console.error('Public key not loaded.');
               // createUserFromPayload(null);
               await fetchAndStoreNewToken(importedPublicKey);
          }
        }
        // Otherwise, check for JWT in localStorage
        else {
          const storedToken = getStoredJWT();
          if (storedToken) {
             if (importedPublicKey) {
              const result = await validateJWT(storedToken, importedPublicKey);
              if (result.isValid) {
                createUserFromPayload(result.payload);
              } else {
                // Token is invalid or expired, remove it and fetch new one
                console.error('JWT verification failed for stored token');
                localStorage.removeItem(JWT_STORAGE_KEY);
                // createUserFromPayload(null);
                await fetchAndStoreNewToken(importedPublicKey);
              }
             } else {
               console.error('Public key not loaded.');
               // createUserFromPayload(null);
               await fetchAndStoreNewToken(importedPublicKey);
             }
          } else {
            // No token found
            // createUserFromPayload(null);
            await fetchAndStoreNewToken(importedPublicKey);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // createUserFromPayload(null);
        // Try one last time to get a guest token?
        // Maybe better not to infinite loop if API is down
        // invoke fetchAndStoreNewToken(null) if public key failed?
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [publicKeyPEM]);

  // Create a user object from JWT payload
  const createUserFromPayload = (payload: JWTPayload | null) => {
    if (!payload) {
      setUser(null);
      setLocations([]);
      // Clear telemetry data when user is not available
      return;
    }
    
    // Extract name from payload, use fallbacks
    const name = payload.name as string || 'Anonymous User';
    
    // For email, try to get from payload or use fallback
    // let email = 'user@example.com';
    let email = '';
    if (payload.email) {
      email = payload.email as string;
    } else if (payload.sub) {
      email = `${payload.sub}@example.com`;
    }
    
    // Extract mobile from payload, use fallback
    const mobile = (payload as any)?.mobile as string || '';
    
    // Extract guest user flag
    const is_guest_user = (payload as any)?.is_guest_user === true;

    setUser({
      authenticated: true,
      username: name,
      email: email,
      mobile: mobile,
      is_guest_user: is_guest_user
    });

    // Extract locations array from JWT payload
    const locationsData = (payload as any)?.locations as Location[] | undefined;
    const validatedLocations: Location[] = [];
    
    if (Array.isArray(locationsData)) {
      locationsData.forEach((loc) => {
        if (loc && typeof loc === 'object' && 
            typeof loc.location_type === 'string' &&
            typeof loc.district === 'string' &&
            typeof loc.village === 'string' &&
            typeof loc.taluka === 'string' &&
            ['registered_location', 'device_location', 'agristack_location'].includes(loc.location_type)) {
          validatedLocations.push({
            location_type: loc.location_type as 'registered_location' | 'device_location' | 'agristack_location',
            district: loc.district,
            village: loc.village,
            taluka: loc.taluka,
            lgd_code: String((loc as any).lgd_code ?? '')
          });
        }
      });
    }
    
    setLocations(validatedLocations);

  };

  // Store JWT in localStorage with expiration
  const storeJWT = (token: string) => {
    try {
      const expiryFromToken = getTokenExpiryFromExp(token);
      if (!expiryFromToken) {
        console.error('JWT exp claim missing; refusing to store token with synthetic expiry');
        return false;
      }
      
      const tokenData = {
        token,
        expiry: expiryFromToken
      };
      
      localStorage.setItem(JWT_STORAGE_KEY, JSON.stringify(tokenData));
      return true;
    } catch (error) {
      console.error("Error storing JWT:", error);
      return false;
    }
  };

  // Retrieve JWT from localStorage
  const getStoredJWT = (): string | null => {
    try {
      const tokenData = localStorage.getItem(JWT_STORAGE_KEY);
      if (!tokenData) return null;
      
      const parsedData = JSON.parse(tokenData);
      const now = new Date().getTime();
      
      // Check if token is expired
      if (now > parsedData.expiry) {
        localStorage.removeItem(JWT_STORAGE_KEY);
        return null;
      }
      
      return parsedData.token;
    } catch (error) {
      console.error("Error retrieving JWT:", error);
      return null;
    }
  };

  // No longer redirecting to error page
  // const redirectToErrorPage = () => {
  //   if (typeof window !== 'undefined' && !window.location.pathname.includes('/error')) {
  //     console.log('Redirecting to /error?reason=auth from AuthContext');
  //     window.location.href = '/error?reason=auth';
  //   }
  // };

  // Function to validate JWT and extract payload
  async function validateJWT(token: string, key: CryptoKey): Promise<{ isValid: boolean; payload: JWTPayload | null }> {
    // Stub mode: the local token carries a fake signature, so decode the claims
    // instead of verifying them. Never reached unless stubs.skipJwtVerification
    // is on in config.json.
    if (SKIP_JWT_VERIFICATION) {
      const payload = decodeJwtPayload(token) as JWTPayload | null;
      return { isValid: payload !== null, payload };
    }

    try {
      const { payload } = await jwtVerify(token, key);
      return { isValid: true, payload };
    } catch (e) {
      console.error('JWT verification failed:', e);
      return { isValid: false, payload: null };
    }
  }

  // Public method to set auth token
  const setAuthToken = async (token: string): Promise<boolean> => {
    try {
      if (publicKey) {
        const result = await validateJWT(token, publicKey);
        if (result.isValid) {
          storeJWT(token);
          createUserFromPayload(result.payload);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error setting auth token:", error);
      return false;
    }
  };

  // Login function - to be implemented with actual API call
  const login = async (username: string, password: string): Promise<boolean> => {
    // This should be implemented with actual API call
    setIsLoading(true);
    try {
      // In a real implementation, this would call your authentication API
      // and get back a real JWT token
      console.log('Login called with:', username, password);
      return false; // Return false since we're not implementing real login yet
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Clear user data and token
    setUser(null);
    setLocations([]);
    localStorage.removeItem(JWT_STORAGE_KEY);
    // Clear all telemetry data on logout
  };

  return (
    <AuthContext.Provider value={{ user, locations, isLoading, login, logout, setAuthToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
