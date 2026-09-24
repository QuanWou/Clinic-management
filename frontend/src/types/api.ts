export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
};

export type ApiError = {
  errorCode?: string;
  message: string;
};
