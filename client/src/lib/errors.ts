import axios from 'axios';

interface ServerErrorItem {
  field?: string;
  message: string;
}

interface ServerErrorResponse {
  success?: boolean;
  message?: string;
  errors?: ServerErrorItem[] | string[] | string | Record<string, unknown>;
}

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as ServerErrorResponse;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const details = data.errors
        .map((err) => {
          if (typeof err === 'string') return err;
          if (err && typeof err === 'object') {
            const item = err as ServerErrorItem;
            return item.field ? `${item.field}: ${item.message}` : item.message;
          }
          return String(err);
        })
        .join('; ');

      if (data.message && data.message !== 'Validation error') {
        return `${data.message} (${details})`;
      }
      return details;
    }

    if (typeof data.errors === 'string') {
      return data.errors;
    }

    if (data.message) {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};
