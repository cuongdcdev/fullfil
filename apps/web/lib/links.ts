export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL?.replace(/\/$/, "") || "";
export const BECOME_A_FULFILLER_URL = REPO_URL
  ? `${REPO_URL}/blob/main/docs/BECOME_A_FULFILLER.md` : "";
