/** Postgres/PostgREST error → plain-language message for users. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "23505":
      return "That already exists. Use a different name or code.";
    case "42501":
      return "You don't have permission to do that.";
    case "23503":
      return "That item is linked to other records and can't be changed this way.";
    case "23514":
    case "22023":
      return "Some values aren't allowed. Check the form and try again.";
    case "P0001":
    case "P0002":
      // Raised deliberately by our own database functions with user-facing text.
      return error.message ?? "That couldn't be done.";
    default:
      return "Something went wrong. Please try again.";
  }
}
