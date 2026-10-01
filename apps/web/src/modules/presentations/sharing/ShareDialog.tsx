import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import QRCode from "qrcode";
import { X, Check, Loader2 } from "lucide-react";
import { quizService } from "../api/presentationRepository.ts";
import { ApiError } from "../../../shared/api/http.ts";
import {
  ACCESS_CODE_MAX_LENGTH,
  ACCESS_CODE_MIN_LENGTH,
  isValidAccessCode,
  normalizeAccessCode,
} from "../../../shared/forms/accessCode.ts";
import { fa } from "../../../shared/i18n/fa";
import Notice from "../../../shared/ui/Notice";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import { Input } from "../../../shared/ui/primitives/Input.tsx";


type ShareDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  accessCode: string;
  onAccessCodeSaved?: (accessCode: string) => void;
  quizId: string;
};

type MenuItemProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

type InviteAudienceProps = {
  BASE: string;
  code: string;
  onCodeChange: (value: string) => void;
  qr: string;
  inputError: string;
  onSave: () => void | Promise<void>;
  onConfirmSave: () => void | Promise<void>;
  onCancelConfirm: () => void;
  isSaving: boolean;
  saveError: string;
  saveSuccess: boolean;
  hasChanges: boolean;
  confirmingSave: boolean;
  isCodeValid: boolean;
};

export default function ShareMenu({
  isOpen,
  onClose,
  accessCode,
  onAccessCodeSaved,
  quizId,
}: ShareDialogProps) {

  const [section, setSection] = useState<"invite">("invite");
  const [code, setCode] = useState(accessCode || "");
  const [initialCode, setInitialCode] = useState(accessCode || "");
  const [qr, setQr] = useState("");
  const [inputError, setInputError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const baseOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://proslides.ir";
  const BASE = `${baseOrigin}/`;


  const validateCode = (input: string): string => {
    if (!input) return "";
    if (input.length < ACCESS_CODE_MIN_LENGTH) {
      return "کد ورود باید حداقل ۵ نویسه باشد.";
    }
    return isValidAccessCode(input)
      ? ""
      : "کد ورود باید فقط شامل حروف انگلیسی و عدد باشد.";
  };


  // Save code in the backend
  const saveAccessCode = async () => {
    if (!code || inputError || code.length < 5) return false;

    if (!quizId) {
      setSaveError("این ارائه در دسترس نیست.");
      return false;
    }
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const result = await quizService.setAccessCode(quizId, code);
      const updatedCode = result.access_code;
      setCode(updatedCode);
      setInitialCode(updatedCode);
      setSaveSuccess(true);
      if (onAccessCodeSaved) {
        onAccessCodeSaved(updatedCode);
      }

      // Delete success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      return true;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "access_code_taken"
      ) {
        setSaveError("این کد ورود قبلاً استفاده شده است.");
      } else {
        setSaveError("ذخیره کد ورود انجام نشد. دوباره تلاش کنید.");
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = code !== initialCode;

  const handleSave = async () => {
    if (!isCodeValid || isSaving || !hasChanges) return;
    if (initialCode && !confirmingSave) {
      setConfirmingSave(true);
      return;
    }
    const saved = await saveAccessCode();
    if (saved) {
      setConfirmingSave(false);
    }
  };

  const handleConfirmSave = async () => {
    const saved = await saveAccessCode();
    if (saved) {
      setConfirmingSave(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmingSave(false);
  };

  const isCodeValid = isValidAccessCode(code) && !inputError;

  const handleCodeChange = (nextCode: string) => {
    const normalized = normalizeAccessCode(nextCode);
    setCode(normalized);
    setInputError(validateCode(normalized));
    setSaveError("");
    setSaveSuccess(false);
    setConfirmingSave(false);
  };


  // Update code when accessCode prop changes
  useEffect(() => {
    if (accessCode) {
      setCode(accessCode);
      setInitialCode(accessCode);
      setInputError(validateCode(accessCode));
      setSaveError("");
      setSaveSuccess(false);
      setConfirmingSave(false);
    } else {
      setCode("");
      setInitialCode("");
      setInputError("");
      setSaveError("");
      setSaveSuccess(false);
      setConfirmingSave(false);
    }
  }, [accessCode]);


  // Generate QR Code
  useEffect(() => {
    if (!code || inputError || code.length < 5) {
      setQr("");
      return;
    }

    const full = BASE + code;
    QRCode.toDataURL(full, { margin: 2 })
      .then((url) => setQr(url))
      .catch((err) => console.error(err));
  }, [BASE, code, inputError]);


  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-overlay-soft" />
        <DialogPrimitive.Content
          ref={contentRef}
          dir="rtl"
          className="fixed left-1/2 top-1/2 z-[101] flex h-auto max-h-[90dvh] w-[min(900px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-panel bg-surface shadow-panel outline-none md:h-[500px] md:flex-row"
          aria-labelledby="share-dialog-title"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current
              ?.querySelector<HTMLInputElement>("#share-access-code")
              ?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              className="absolute end-5 top-5 z-10 rounded-control p-1 text-content-muted hover:bg-brand-soft hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={fa.share.close}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </DialogPrimitive.Close>

          <div className="flex w-full flex-col gap-3 border-b border-brand-border bg-brand-soft p-5 md:w-1/3 md:border-b-0 md:border-e">
            <DialogPrimitive.Title asChild>
              <h2 id="share-dialog-title" className="mb-2 text-lg font-semibold text-brand-strong">
                {fa.share.title}
              </h2>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              کد ورود و کد QR ارائه را برای مخاطبان مدیریت کنید.
            </DialogPrimitive.Description>
            <MenuItem
              label={fa.share.inviteAudience}
              active={section === "invite"}
              onClick={() => setSection("invite")}
            />
          </div>

          <div className="w-full overflow-y-auto p-6 md:w-2/3">
            {section === "invite" && (
              <InviteAudienceUI
                BASE={BASE}
                code={code}
                onCodeChange={handleCodeChange}
                qr={qr}
                inputError={inputError}
                onSave={handleSave}
                onConfirmSave={handleConfirmSave}
                onCancelConfirm={handleCancelConfirm}
                isSaving={isSaving}
                saveError={saveError}
                saveSuccess={saveSuccess}
                hasChanges={hasChanges}
                confirmingSave={confirmingSave}
                isCodeValid={isCodeValid}
              />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}


function MenuItem({ label, active, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`w-full rounded-control px-3 py-2 text-start font-medium transition
        ${
          active
            ? "bg-brand-muted text-brand-strong"
            : "text-content-muted hover:bg-brand-muted"
        }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}


function InviteAudienceUI({
  BASE,
  code,
  onCodeChange,
  qr,
  inputError,
  onSave,
  onConfirmSave,
  onCancelConfirm,
  isSaving,
  saveError,
  saveSuccess,
  hasChanges,
  confirmingSave,
  isCodeValid
}: InviteAudienceProps) {

  const handleCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    onCodeChange(normalizeAccessCode(e.target.value));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
  };


  // Checking the validity of the code to enable/disable the save button
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-content">
        {fa.share.inviteAudience}
      </h2>

      <p className="text-sm text-content-muted">مخاطبان از این نشانی وارد می‌شوند:</p>

      {/* --------------- Code Entry Section --------------- */}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        <bdi className="text-content-muted" dir="ltr">{BASE}</bdi>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <label htmlFor="share-access-code" className="sr-only">
            کد ورود ارائه
          </label>
          <Input
            id="share-access-code"
            className="w-full flex-none font-brand uppercase tracking-wider sm:w-[16ch] md:w-[18ch]"
            placeholder="ROOM1"
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            maxLength={ACCESS_CODE_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-describedby={
              inputError
                ? "access-code-help access-code-error"
                : "access-code-help"
            }
            aria-invalid={Boolean(inputError)}
            dir="ltr"
          />
          <Button
            type="button"
            onClick={onSave}
            disabled={!isCodeValid || !hasChanges || isSaving}
            aria-busy={isSaving || undefined}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                در حال ذخیره…
              </>
            ) : (
              <>
                <Check aria-hidden="true" />
                ذخیره
              </>
            )}
          </Button>
        </div>
      </div>

      <p id="access-code-help" className="mt-2 text-xs text-content-muted">
        بین ۵ تا ۱۲ نویسه؛ حروف انگلیسی و عدد. ارقام فارسی نیز پذیرفته و تبدیل می‌شوند.
      </p>


      {/* --------------- Display Validation Error Message --------------- */}
      {inputError && (
        <p id="access-code-error" className="mt-3 text-sm text-danger" role="alert">
          {inputError}
        </p>
      )}

      {isSaving && <Notice pending className="mt-3">در حال ذخیره کد ورود…</Notice>}

      {saveSuccess && (
        <Notice tone="success" className="mt-3">کد ورود ذخیره شد.</Notice>
      )}

      {saveError && (
        <Notice tone="error" className="mt-3">{saveError}</Notice>
      )}

      {confirmingSave && (
        <Notice tone="warning" className="mt-4 flex-col items-stretch">
          تغییر کد ورود، لینک قبلی را غیرفعال می‌کند. ادامه می‌دهید؟
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onConfirmSave}
              disabled={isSaving}
            >
              تأیید و ذخیره
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancelConfirm}
            >
              انصراف
            </Button>
          </div>
        </Notice>
      )}

      {/* --------------- Display QR Code Only If The Code Is Valid And There Are No Errors --------------- */}
      {qr && !inputError && code.length >= 5 && (
        <div className="mt-6 flex flex-col items-center">
          <p className="mb-2 text-sm text-content-muted">کد QR را اسکن کنید</p>
          <img
            src={qr}
            alt="کد QR لینک ورود به ارائه"
            className="size-44 rounded-card border border-border-subtle bg-surface"
          />

          <Button asChild size="sm" className="mt-3">
            <a download="qr.png" href={qr}>
              دریافت کد QR
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
