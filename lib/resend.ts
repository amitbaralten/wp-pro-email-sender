import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === "re_your_resend_api_key_here") {
    throw new Error("Missing or invalid RESEND_API_KEY in environment variables. Please set your Resend API key in .env.local.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}
