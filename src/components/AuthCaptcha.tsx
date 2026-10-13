import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const isAuthCaptchaConfigured = Boolean(siteKey);

export type AuthCaptchaHandle = {
  reset: () => void;
};

type AuthCaptchaProps = {
  onTokenChange: (token: string | null) => void;
};

function AuthCaptchaComponent(
  { onTokenChange }: AuthCaptchaProps,
  ref: ForwardedRef<AuthCaptchaHandle>,
) {
  const { t } = useTranslation();
  const widgetRef = useRef<TurnstileInstance | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        widgetRef.current?.reset();
        onTokenChange(null);
      },
    }),
    [onTokenChange],
  );

  if (!siteKey) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t("auth.captcha.prompt")}
      </p>
      <Turnstile
        ref={widgetRef}
        siteKey={siteKey}
        onSuccess={onTokenChange}
        onExpire={() => onTokenChange(null)}
        onError={() => onTokenChange(null)}
      />
    </div>
  );
}

export const AuthCaptcha = forwardRef(AuthCaptchaComponent);
