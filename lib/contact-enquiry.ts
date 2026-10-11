import { trackConfirmedLead } from "@/lib/analytics";

type ContactResult =
  | { success: true }
  | { success: false; error: string };

export async function submitContactEnquiry(
  fields: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<ContactResult> {
  try {
    const response = await fetcher("/api/contact/", {
      method: "POST",
      body: JSON.stringify(fields),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const result = await response.json().catch(() => null);
    if (
      response.ok &&
      result?.message === "Your enquiry has been submitted."
    ) {
      trackConfirmedLead();
      return { success: true };
    }

    return {
      success: false,
      error:
        typeof result?.error === "string"
          ? result.error
          : "We couldn’t send your enquiry. Please try again.",
    };
  } catch {
    return {
      success: false,
      error:
        "A network issue prevented sending. Please try again or email support@digipants.com.",
    };
  }
}
