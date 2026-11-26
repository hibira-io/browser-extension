import { describe, expect, it } from 'vitest';
import { classifyPage, isFinalSubmit, isSecretField } from '../src/core/policy';

function page(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe('classifyPage', () => {
  it('leaves sign-in forms to the person', () => {
    expect(classifyPage(page('<h1>Welcome back</h1><input type="email"><input type="password">'), 'https://a.test/')).toBe('login');
    expect(classifyPage(page('<p>hi</p>'), 'https://a.test/users/sign_in')).toBe('login');
  });
  it('leaves sign-up forms to the person', () => {
    expect(classifyPage(page('<input type="password"><input type="password">'), 'https://a.test/x')).toBe('register');
    expect(classifyPage(page('<input type="password" autocomplete="new-password">'), 'https://a.test/x')).toBe('register');
    expect(classifyPage(page('<p>hi</p>'), 'https://a.test/signup')).toBe('register');
  });
  it('leaves robot checks to the person', () => {
    expect(classifyPage(page('<div class="cf-turnstile"></div>'), 'https://a.test/')).toBe('captcha');
    expect(classifyPage(page('<iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>'), 'https://a.test/')).toBe('captcha');
  });
  it('works on ordinary pages', () => {
    expect(classifyPage(page('<h1>Orders</h1><input type="search"><button>Search</button>'), 'https://a.test/orders')).toBeNull();
  });
  it('ignores hidden password fields', () => {
    expect(classifyPage(page('<input type="password" style="display:none">'), 'https://a.test/')).toBeNull();
  });
});

describe('isFinalSubmit', () => {
  it('treats form submit buttons as submits', () => {
    page('<form><input name="q"><button id="b">Go</button></form>');
    expect(isFinalSubmit(document.getElementById('b')!)).toBe(true);
    page('<form><input type="submit" id="b" value="OK"></form>');
    expect(isFinalSubmit(document.getElementById('b')!)).toBe(true);
  });
  it('treats committing verbs as submits', () => {
    page('<button type="button" id="a">Save changes</button><div role="button" id="b">刪除</div><button id="c">Place order</button>');
    for (const id of ['a', 'b', 'c']) expect(isFinalSubmit(document.getElementById(id)!)).toBe(true);
  });
  it('lets navigation and filters run', () => {
    page('<button type="button" id="a">Next page</button><a href="/x" id="b">Save money tips</a><button type="button" id="c">Apply filters</button><form><button type="button" id="d">Show more</button></form>');
    for (const id of ['a', 'b', 'c', 'd']) expect(isFinalSubmit(document.getElementById(id)!)).toBe(false);
  });
});

describe('isSecretField', () => {
  it('flags passwords, card numbers and codes', () => {
    page('<input id="a" type="password"><input id="b" autocomplete="cc-number"><input id="c" name="otp"><input id="d" name="city">');
    expect(isSecretField(document.getElementById('a')!)).toBe(true);
    expect(isSecretField(document.getElementById('b')!)).toBe(true);
    expect(isSecretField(document.getElementById('c')!)).toBe(true);
    expect(isSecretField(document.getElementById('d')!)).toBe(false);
  });
});
