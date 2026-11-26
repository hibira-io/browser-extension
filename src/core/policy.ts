// What Hibi may do on a page. One rule set, shared with the Secretary SDK:
//
//  - Sign-in, sign-up and robot-verification pages are the person's own:
//    Hibi reads nothing there and does nothing there.
//  - A final submit (send, save, pay, delete, place order...) is filled in
//    by Hibi and then waits for the person's approval.
//  - Everything else (menus, tabs, search, filters, typing, paging) runs
//    without asking at each step.
//  - Passwords and card numbers are never read or typed.

export type PageBlock = 'login' | 'register' | 'captcha';

const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha.com"]',
  'iframe[src*="challenges.cloudflare.com"]',
  '.g-recaptcha',
  '.h-captcha',
  '.cf-turnstile',
  '[data-sitekey]',
  '#challenge-form',
  '#cf-challenge-running',
];

const REGISTER_WORDS =
  /\b(sign[\s-]?up|register|create (an |your )?account|join now)\b|註冊|注册|建立帳號|创建账号|新規登録|会員登録|회원가입|가입하기/i;
const LOGIN_WORDS =
  /\b(log[\s-]?in|sign[\s-]?in|signin|login)\b|登入|登录|ログイン|サインイン|로그인/i;
const LOGIN_PATH = /\/(login|log-in|signin|sign-in|sign_in|auth|sso|oauth|session\/new|users\/sign_in)(\/|$|\?|#)/i;
const REGISTER_PATH = /\/(signup|sign-up|sign_up|register|registration|join|users\/sign_up)(\/|$|\?|#)/i;

/** classifyPage says whether the page is one Hibi must leave to the person. */
export function classifyPage(doc: Document, url: string): PageBlock | null {
  for (const sel of CAPTCHA_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && isShown(el)) return 'captcha';
  }
  const passwords = [...doc.querySelectorAll<HTMLInputElement>('input[type="password"]')].filter(isShown);
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    path = '';
  }
  if (REGISTER_PATH.test(path)) return 'register';
  if (LOGIN_PATH.test(path)) return 'login';
  if (passwords.length === 0) return null;
  // A visible password field: a sign-up form when it asks twice or says so,
  // otherwise a sign-in form. Settings pages that change a password are
  // also left to the person.
  const newPassword = passwords.some((p) => p.autocomplete === 'new-password');
  const heading = textOf(doc.querySelector('h1, h2, title'));
  if (passwords.length >= 2 || newPassword || REGISTER_WORDS.test(heading)) return 'register';
  return 'login';
}

const SUBMIT_WORDS =
  /\b(submit|send|save|publish|post|pay|purchase|buy|order|checkout|check out|place order|confirm|delete|remove|update|create|add|book|reserve|transfer|approve|accept|sign|subscribe|cancel subscription|deploy|merge)\b|送出|提交|儲存|保存|存檔|發布|发布|付款|支付|購買|购买|下單|下单|確認|确认|刪除|删除|更新|建立|创建|新增|預約|预约|送信|保存する|購入|注文|確定|削除|作成|追加|予約|저장|제출|전송|결제|구매|주문|확인|삭제|생성|추가|예약/i;

/**
 * isFinalSubmit says whether clicking el commits something: a form's submit
 * button, or a button whose label is a committing verb.
 */
export function isFinalSubmit(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (tag === 'input' && (type === 'submit' || type === 'image')) return true;
  if (tag === 'button' && el.closest('form') && (type === '' || type === 'submit')) return true;
  const role = el.getAttribute('role');
  const isButton = tag === 'button' || role === 'button' || (tag === 'input' && type === 'button');
  if (!isButton) return false;
  return SUBMIT_WORDS.test(labelOf(el));
}

/** isSecretField is a field Hibi never reads or types into. */
export function isSecretField(el: Element): boolean {
  if (el.tagName.toLowerCase() !== 'input') return false;
  const input = el as HTMLInputElement;
  if (input.type === 'password') return true;
  const ac = (input.autocomplete || '').toLowerCase();
  if (/cc-number|cc-csc|cc-exp|one-time-code|current-password|new-password/.test(ac)) return true;
  const name = `${input.name} ${input.id}`.toLowerCase();
  return /(card.?number|cardnum|cvv|cvc|security.?code|otp|totp|2fa)/.test(name);
}

export function labelOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  if (el.tagName.toLowerCase() === 'input') {
    const input = el as HTMLInputElement;
    if (input.value && ['submit', 'button', 'reset'].includes(input.type)) return input.value;
  }
  const t = textOf(el);
  if (t) return t;
  return (el.getAttribute('title') ?? el.getAttribute('alt') ?? '').trim();
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isShown(el: Element): boolean {
  const h = el as HTMLElement;
  if (h.hidden) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(h);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  if ((el as HTMLInputElement).type === 'hidden') return false;
  return true;
}
