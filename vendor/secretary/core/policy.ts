// What the assistant may do on its own, what waits for the user's approval
// and what it never does. Hibira's rule for Secretary:
//
// - Never: signing in, signing up, passwords and robot checks (CAPTCHA,
//   Turnstile, reCAPTCHA, hCaptcha). The user does those themselves.
// - Ask first: the last step that sends something off (submitting a form,
//   saving, sending, deleting, paying, publishing).
// - Everything else runs: opening menus, tabs and links, searching,
//   filtering, typing into fields, choosing options, scrolling.
//
// A page can override this for an element with data-secretary="safe"
// (runs), "confirm" (asks) or "never" (refused).
//
// The policy works on a plain description of the element, so it is the
// same in the page and in tests.

export interface Target {
  tag: string;
  /** The input's type, or the button's ("submit" for a button in a form with no type). */
  type?: string;
  role?: string;
  /** Visible name: text, aria-label, value or title. */
  name: string;
  /** data-secretary on the element or an ancestor. */
  override?: 'safe' | 'confirm' | 'never';
  autocomplete?: string;
  /** href for links, already resolved. */
  href?: string;
  sameOrigin?: boolean;
  /** The element's form, if any. */
  form?: { hasPassword: boolean; action?: string; name: string };
  /** Attributes a framework uses for click handlers (wire:click, @click...). */
  handler?: string;
  /** Inside a robot check (CAPTCHA frame or widget). */
  captcha?: boolean;
}

export type Decision = { kind: 'run' } | { kind: 'ask'; why: string } | { kind: 'refuse'; why: string };

const RUN: Decision = { kind: 'run' };

const AUTH_WORDS =
  /\b(log ?in|sign ?in|sign ?up|register|create (an )?account|password|passcode|forgot|two[- ]?factor|2fa|otp|verification code)\b|登入|登录|註冊|注册|密碼|密码|驗證碼|验证码|ログイン|サインイン|新規登録|会員登録|パスワード|로그인|회원가입|비밀번호|เข้าสู่ระบบ|สมัครสมาชิก|รหัสผ่าน|đăng nhập|đăng ký|mật khẩu/i;

const AUTH_PATH = /\/(login|log-in|signin|sign-in|sign_in|signup|sign-up|sign_up|register|registration|password|forgot|reset-password|two-factor|2fa|otp|auth)(\/|$|\?|#)/i;

const SUBMIT_WORDS =
  /\b(submit|save|update|create|add|send|post|publish|confirm|apply|delete|remove|archive|cancel (order|subscription|plan)|refund|pay|purchase|buy|checkout|place order|approve|reject|invite|import|upload|transfer|sign|accept)\b|送出|提交|儲存|保存|存檔|建立|新增|创建|新建|發送|发送|發佈|发布|刪除|删除|移除|確認|确认|付款|支付|購買|购买|結帳|结账|退款|核准|批准|拒絕|拒绝|邀請|邀请|上傳|上传|送信|保存|作成|追加|削除|確定|購入|支払|承認|제출|저장|생성|추가|전송|게시|삭제|확인|결제|구매|승인|ส่ง|บันทึก|สร้าง|เพิ่ม|ลบ|ยืนยัน|ชำระ|ซื้อ|gửi|lưu|tạo|thêm|xóa|xác nhận|thanh toán|mua/i;

/** Whether the page itself is a sign-in, sign-up or password page. */
export function authPage(path: string, title: string, hasPasswordField: boolean): boolean {
  return hasPasswordField || AUTH_PATH.test(path) || AUTH_WORDS.test(title);
}

const never = (why: string): Decision => ({ kind: 'refuse', why });
const ask = (why: string): Decision => ({ kind: 'ask', why });

const AUTH_REFUSAL = 'Signing in, signing up and passwords are for the person to do themselves. Ask them to do it.';
const CAPTCHA_REFUSAL = 'Robot checks (CAPTCHA) are for the person to do themselves. Ask them to do it.';

/** A click on t. */
export function decideClick(t: Target): Decision {
  if (t.override === 'never') return never('This control is not available to the assistant.');
  if (t.captcha) return never(CAPTCHA_REFUSAL);
  if (t.form?.hasPassword || isAuthControl(t)) return never(AUTH_REFUSAL);
  if (t.override === 'safe') return RUN;
  if (t.override === 'confirm') return ask('changes something');
  if (t.tag === 'a' && t.href) {
    if (AUTH_PATH.test(t.href)) return never(AUTH_REFUSAL);
    // Opening a link is a GET; a link that posts (Rails, Laravel) is not.
    if (/data-method|delete|post/i.test(t.handler ?? '')) return ask('sends something');
    return RUN;
  }
  if (isSubmit(t)) return ask('sends the form');
  if (SUBMIT_WORDS.test(t.name) && !opensSomething(t)) return ask('sends something');
  return RUN;
}

/** Typing into t (submit: pressing Enter afterwards). */
export function decideType(t: Target, submit: boolean): Decision {
  if (t.override === 'never') return never('This field is not available to the assistant.');
  if (t.captcha) return never(CAPTCHA_REFUSAL);
  if (t.type === 'password' || /password|one-time-code/.test(t.autocomplete ?? '') || t.form?.hasPassword || isAuthControl(t)) return never(AUTH_REFUSAL);
  if (/^cc-/.test(t.autocomplete ?? '')) return never('Card numbers and other payment details are for the person to type themselves.');
  if (t.type === 'file') return never('Choosing files is for the person to do themselves.');
  if (submit) {
    // Enter in a search box only searches.
    if (t.type === 'search' || t.role === 'searchbox' || t.role === 'combobox' || /search|filter|搜尋|搜索|検索|검색|ค้นหา|tìm/i.test(t.name)) return RUN;
    return ask('sends the form');
  }
  return RUN;
}

/** Choosing an option in t. */
export function decideSelect(t: Target): Decision {
  if (t.override === 'never') return never('This field is not available to the assistant.');
  if (t.captcha) return never(CAPTCHA_REFUSAL);
  if (t.form?.hasPassword || isAuthControl(t)) return never(AUTH_REFUSAL);
  return RUN;
}

function isAuthControl(t: Target): boolean {
  return AUTH_WORDS.test(t.name) && (t.tag === 'button' || t.tag === 'input' || t.role === 'button' || !!t.form);
}

function isSubmit(t: Target): boolean {
  return (t.tag === 'button' || t.tag === 'input') && (t.type === 'submit' || t.type === 'image');
}

/** Controls that open a menu, a dialog or a section rather than act. */
function opensSomething(t: Target): boolean {
  return /^(tab|menuitem|option|treeitem)$/.test(t.role ?? '') || /aria-haspopup|aria-expanded|mountAction|mountTableAction|openModal|\$dispatch\('open/i.test(t.handler ?? '');
}
