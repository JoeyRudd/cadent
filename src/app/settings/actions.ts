"use server";

import { refresh } from "next/cache";

import { connectGarmin, disconnectGarmin, type ConnectState } from "@/lib/garmin";

/** Garmin's sign-in codes are six digits; anything else never reaches the script. */
const CODE = /^\d{6}$/;

/** Connects Garmin from the Settings form: email and password first, then the MFA code if Garmin asks. */
export async function connect(_prev: ConnectState, form: FormData): Promise<ConnectState> {
  const code = form.get("code")?.toString().trim();
  const email = form.get("email")?.toString().trim();
  const password = form.get("password")?.toString();
  let state: ConnectState;
  if (code !== undefined) {
    if (!CODE.test(code)) return { step: "mfa", error: "Enter the 6-digit code from Garmin." };
    state = await connectGarmin({ code });
  } else if (email && password) {
    state = await connectGarmin({ email, password });
  } else {
    return { error: "Enter your Garmin email and password." };
  }
  if (state.connected) refresh();
  return state;
}

/** Deletes Garmin's saved token. */
export async function disconnect(): Promise<string | undefined> {
  const error = await disconnectGarmin();
  if (!error) refresh();
  return error;
}
