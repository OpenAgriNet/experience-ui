import { MutationCache, QueryClient } from "@tanstack/react-query";
import { onRequestError } from "./on-request-error";

/**
 * The shared query client.
 *
 * Nothing calls useQuery or useMutation yet — chat streams into the Zustand
 * store rather than being cached, and it is the only live endpoint. This exists
 * so that the first thing which does need caching, invalidation or retries has
 * somewhere to plug in.
 */
export const queryClient = new QueryClient({
	mutationCache: new MutationCache({
		onError: onRequestError
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1
		}
	}
});
