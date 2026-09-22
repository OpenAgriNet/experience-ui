import { createFileRoute } from "@tanstack/react-router";
import DefaultError from ".";

export const Route = createFileRoute("/error")({
	component: DefaultError
});
