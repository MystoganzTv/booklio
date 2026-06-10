/**
 * DialogProvider — app-wide replacement for the native Alert.alert.
 *
 * Mounts a single BooklizDialog at the root and exposes:
 *   const dialog = useDialog();
 *   dialog.alert(title, body)                          // one button
 *   dialog.alert(title, body, () => goBack())          // one button + callback
 *   dialog.confirm({ title, body, confirmLabel, destructive, onConfirm })
 *
 * Keeps every dialog on-brand (theme-aware, consistent typography) instead of
 * the OS-styled Alert popups.
 */
import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";
import { useI18n } from "../i18n/LocalizationContext";
import { BooklizDialog } from "./BooklizDialog";

type ConfirmOptions = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

type DialogContextValue = {
  alert: (title: string, body: string, onDone?: () => void) => void;
  confirm: (options: ConfirmOptions) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type ActiveDialog = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  twoButtons: boolean;
};

export function DialogProvider({ children }: PropsWithChildren) {
  const { t } = useI18n();
  const [active, setActive] = useState<ActiveDialog | null>(null);

  const alert = useCallback((title: string, body: string, onDone?: () => void) => {
    setActive({
      title,
      body,
      confirmLabel: t("common.okay"),
      destructive: false,
      onConfirm: onDone,
      twoButtons: false,
    });
  }, [t]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setActive({
      title: options.title,
      body: options.body,
      confirmLabel: options.confirmLabel ?? t("common.okay"),
      cancelLabel: options.cancelLabel ?? t("common.cancel"),
      destructive: options.destructive ?? false,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      twoButtons: true,
    });
  }, [t]);

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <BooklizDialog
        open={Boolean(active)}
        title={active?.title ?? ""}
        body={active?.body ?? ""}
        confirmLabel={active?.confirmLabel}
        cancelLabel={active?.cancelLabel}
        variant={active?.destructive ? "destructive" : "default"}
        onConfirm={() => {
          const cb = active?.onConfirm;
          setActive(null);
          cb?.();
        }}
        onCancel={active?.twoButtons ? () => {
          const cb = active?.onCancel;
          setActive(null);
          cb?.();
        } : undefined}
      />
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used inside DialogProvider");
  }
  return context;
}
