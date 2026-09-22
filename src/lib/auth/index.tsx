import { createContext, useContext, type ReactNode } from "react";

/**
 * Identity seam — the only place that decides who the user is.
 *
 * The Experience Layer has no authentication. This returns a fixed local user
 * so the client has someone to render and a session to attach to requests.
 * Nothing here is a security control, and nothing here reaches a network.
 *
 * When authentication arrives, implement it here. The rest of the client
 * depends on this contract and on nothing about how it is satisfied:
 *
 *   useAuth()     -> { user, isLoading }
 *   authHeaders() -> headers attached to every API request
 *
 * Two things a real implementation will have to add back, removed here
 * because nothing could reach them while the user is always present:
 *
 *   - a signed-out state, meaning `user` can be null and `isLoading` true
 *     while that is being decided
 *   - the UI for it — a sign-in prompt, and a disabled composer behind it
 *
 * They are left out rather than stubbed so that whoever adds authentication
 * designs them for the scheme they choose, instead of inheriting a shape
 * built for a different one.
 */

export interface User {
	username: string;
	isGuest: boolean;
}

/** Stands in for a signed-in user until there is something to sign in to. */
const LOCAL_USER: User = {
	username: "Guest",
	isGuest: true
};

interface AuthContextValue {
	user: User | null;
	isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
	user: LOCAL_USER,
	isLoading: false
});

export function AuthProvider({ children }: { children: ReactNode }) {
	// Resolved synchronously: there is nothing to look up. A real
	// implementation will need state here, and isLoading will mean something.
	return (
		<AuthContext.Provider value={{ user: LOCAL_USER, isLoading: false }}>{children}</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	return useContext(AuthContext);
}

/**
 * Headers attached to every request the client makes to its own API.
 *
 * Empty today. A real scheme attaches its credential here — an Authorization
 * header, a signed cookie, whatever it is — and no caller needs to change.
 */
export function authHeaders(): Record<string, string> {
	return {};
}
