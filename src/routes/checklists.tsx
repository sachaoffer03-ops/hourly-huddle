import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/checklists")({
  beforeLoad: () => {
    throw redirect({ to: "/cloture" });
  },
});
