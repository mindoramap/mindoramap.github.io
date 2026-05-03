const SAFE_NODE_URL_PROTOCOLS = new Set(["http:", "https:"]);

export const PASSWORD_MIN_LENGTH = 10;

export const validatePasswordPolicy = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use pelo menos 1 letra maiuscula, 1 minuscula e 1 numero";
  }

  return null;
};

export const sanitizeNodeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_NODE_URL_PROTOCOLS.has(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

export const isSafeNodeUrl = (value?: string | null): value is string => {
  if (!value) return false;
  return sanitizeNodeUrl(value) === value;
};
