import { useToastStore } from "@/stores/toast-store";

export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: "success", message }),
  error: (message: string) => useToastStore.getState().addToast({ type: "error", message }),
  info: (message: string) => useToastStore.getState().addToast({ type: "info", message }),
};

export function catchToast(message: string) {
  return (err: unknown) => {
    console.error(message, err);
    toast.error(message);
  };
}
