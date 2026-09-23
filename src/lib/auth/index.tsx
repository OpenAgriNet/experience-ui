import { createContext, useContext, type ReactNode } from "react";

/**
 * Identity seam — the only place that decides who the user is.
 *
 * The Experience Layer has no authentication. This returns a fixed local user
 * so the client has someone to render. Nothing here is a security control,
 * and nothing here reaches a network.
 *
 * When authentication arrives, implement it here. The rest of the client
 * depends on `useAuth()` returning `{ user, isLoading }`, and on nothing
 * about how that is decided.
 *
 * How a credential reaches the API is deliberately not decided here. A bearer
 * token wants a header on each request; a same-site cookie wants nothing at
 * all, since the browser sends it; something else may want
 * `credentials: "include"` on fetch and `withCredentials` on axios. Those are
 * different changes in different places, so guessing one of them now would
 * only be a guess to undo. Requests in `lib/api-service.ts` currently carry
 * no credential.
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

interface User {
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
