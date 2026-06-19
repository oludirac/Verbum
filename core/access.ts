import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "verbum_access";

const getAccessCode = () => process.env.VERBUM_ACCESS_CODE?.trim() ?? "";

const getAccessSecret = () =>
  process.env.VERBUM_ACCESS_SECRET?.trim() ||
  process.env.OPENAI_API_KEY?.trim() ||
  getAccessCode();

export const isAccessControlEnabled = () => getAccessCode().length > 0;

export const createAccessToken = () => {
  const accessCode = getAccessCode();
  const secret = getAccessSecret();

  if (!accessCode || !secret) {
    return "";
  }

  return createHmac("sha256", secret).update(accessCode).digest("hex");
};

export const isValidAccessCode = (candidate: unknown) =>
  typeof candidate === "string" && candidate.trim() === getAccessCode();

export const isValidAccessToken = (candidate: string | undefined) => {
  if (!isAccessControlEnabled()) {
    return true;
  }

  if (!candidate) {
    return false;
  }

  const expected = createAccessToken();
  if (!expected || candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
};
