"""End-to-end test of the shop in a real browser.

Usage: python3 tools/flow_test.py [desktop|phone|tablet|short]   (needs `npm run build && npm run preview -- --port 4173`)
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = 'http://localhost:4173/'
VP = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
SIZES = {'desktop': (1440, 900, False), 'phone': (390, 844, True), 'tablet': (820, 1180, True), 'short': (900, 480, False)}
OUT = '/tmp/shots'
INIT = """
window.__ac = 0;
const AC = window.AudioContext;
window.AudioContext = class extends AC { constructor(...a){ super(...a); window.__ac++; } };
"""
results = []
def check(name, cond, extra=''):
    results.append(('PASS' if cond else 'FAIL', name, extra if not cond else ''))

async def ls(page, key):
    return await page.evaluate(f"JSON.parse(localStorage.getItem('little-fortune-shop:{key}'))")

async def open_fortune(page, shot=None):
    """From an active ritual (draw or cookie mode): wait for cookie, crack it, wait for the paper."""
    await page.wait_for_selector('.cookie-button:not([disabled])', timeout=9000)
    await page.wait_for_timeout(250)
    await page.click('.cookie-button')
    await page.wait_for_selector('.ritual.step-done', timeout=9000)
    await page.wait_for_timeout(750)
    if shot:
        await page.screenshot(path=f'{OUT}/{VP}-{shot}.png')
    return await page.locator('.fortune-text p').inner_text()

async def run(page, errors):
    await page.goto(URL)
    await page.wait_for_timeout(1200)
    broken = await page.evaluate("[...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)")
    check('no broken images', not broken, broken)
    check('no audio before interaction', await page.evaluate('window.__ac') == 0)
    check('plaque says Sign up / 2 free', 'Sign up' in await page.locator('.plaque-text').inner_text() and '2 free' in await page.locator('.account-note').inner_text())
    await page.screenshot(path=f'{OUT}/{VP}-01-shop.png')

    # ---- guest fortune 1
    await page.click('button.tag >> nth=2')
    check('audio unlocked by first touch', await page.evaluate('window.__ac') == 1)
    await page.wait_for_timeout(300)
    await page.click('button.jar')
    t1 = await open_fortune(page, '02-first')
    foot = await page.locator('.ritual-footnote').inner_text()
    check('footnote: 1 free left', '1 free fortune left' in foot, foot)
    await page.click('.ritual-actions .paper-button >> nth=0')
    await page.wait_for_timeout(300)
    check('kept as guest', len(await ls(page, 'guest:kept')) == 1)

    # ---- guest fortune 2 via "Another fortune"
    await page.click('.ritual-actions .paper-button >> nth=1')
    t2 = await open_fortune(page, '03-second')
    check('second fortune differs', t1 != t2)
    foot = await page.locator('.ritual-footnote').inner_text()
    check('footnote: last free', 'last free fortune' in foot, foot)

    # ---- third asks to sign up
    await page.click('.ritual-actions .paper-button >> nth=1')
    await page.wait_for_selector('.panel.account-panel', timeout=4000)
    check('sign-up asked after 2 free', 'free fortunes' in await page.locator('.account-head p').inner_text())
    await page.screenshot(path=f'{OUT}/{VP}-04-signup.png')
    await page.click('.panel-close')
    await page.wait_for_timeout(300)
    check('cord resting when out of free', await page.locator('.category-cord.is-resting').count() == 1)
    await page.click('button.jar')
    await page.wait_for_selector('.panel.account-panel', timeout=4000)
    check('jar asks to sign up too', await page.locator('.ritual').count() == 0)

    # ---- validation
    await page.fill('.account-form input[autocomplete="given-name"]', 'Mei')
    await page.fill('.account-form input[type=email]', 'mei@example.com')
    await page.fill('.account-form input[type=password]', 'short')
    await page.click('.account-form button[type=submit]')
    await page.wait_for_timeout(300)
    check('short password rejected', '8 characters' in await page.locator('.form-error').inner_text())

    # ---- sign up
    await page.fill('.account-form input[type=password]', 'teatime123')
    await page.click('.account-form button[type=submit]')
    await page.wait_for_selector('.panel.account-panel', state='detached', timeout=6000)
    check('plaque shows name', 'Mei' in await page.locator('.plaque-text').inner_text())
    session = await ls(page, 'session')
    uid = session['userId']
    accounts = await ls(page, 'accounts')
    check('password not stored as text', 'teatime123' not in json.dumps(accounts))
    check('guest journal moved into account', len(await ls(page, f'user:{uid}:history')) == 2 and len(await ls(page, f'user:{uid}:kept')) == 1)

    # ---- member: unlimited
    await page.wait_for_timeout(3800)
    await page.click('button.jar')
    await open_fortune(page)
    check('member footnote', 'as many as they like' in await page.locator('.ritual-footnote').inner_text())
    await page.click('.ritual-actions .paper-button >> nth=1')
    await open_fortune(page)
    await page.click('.ritual-actions .paper-button >> nth=1')
    await open_fortune(page, '05-member')
    check('member opened 5 total', len(await ls(page, f'user:{uid}:history')) == 5)
    await page.click('.ritual-footnote .ink-link')
    await page.wait_for_timeout(600)

    # ---- journal with many entries
    await page.evaluate("""(uid) => {
      const k = 'little-fortune-shop:user:' + uid + ':history';
      const h = JSON.parse(localStorage.getItem(k));
      const cats = ['luck','friendship','love','courage','creativity','beginnings','wisdom','surprises'];
      for (let i = 0; i < 40; i++) h.push({ fortuneId: cats[i % 8] + '~A~' + (i % 16) + '.' + ((i * 7) % 16) + '.' + (i % 24), at: Date.now() - (i + 1) * 3600e3 });
      h.push({ fortuneId: 'luck-20', at: Date.now() - 999e5 });
      localStorage.setItem(k, JSON.stringify(h));
    }""", uid)
    await page.reload()
    await page.wait_for_timeout(1000)
    await page.click('button.journal-book-button')
    await page.wait_for_selector('.panel.journal')
    await page.wait_for_timeout(600)
    await page.screenshot(path=f'{OUT}/{VP}-06-journal-kept.png')
    await page.click('.journal-bookmarks button >> nth=1')
    await page.wait_for_timeout(400)
    stats = await page.locator('.journal-stats dd').all_inner_texts()
    check('stats count opened', stats[0] == '46', stats)
    pager = await page.locator('.journal-pager span').inner_text()
    check('pagination', 'of' in pager and not pager.endswith('of 1'), pager)
    await page.screenshot(path=f'{OUT}/{VP}-07-journal-all.png')
    await page.click('.page-turn >> nth=1')
    await page.wait_for_timeout(500)
    check('page turn', 'page 2' in await page.locator('.journal-pager span').inner_text())
    await page.click('.journal-tags button >> nth=0')  # luck
    await page.wait_for_timeout(300)
    texts = await page.locator('.entry-cat').all_inner_texts()
    check('category filter', texts and all('Luck' in t for t in texts), texts)
    await page.click('.rarity-chip.chip-very-rare')
    await page.wait_for_timeout(300)
    check('rarity filter', await page.locator('.entry').count() == 1 and await page.locator('.entry-seal').count() == 1)
    await page.click('.journal-sort .ink-link >> nth=1')  # clear filters
    await page.fill('.journal-search input', 'zzzz-nothing')
    await page.wait_for_timeout(300)
    check('search empty state', await page.locator('.journal-empty').count() == 1)
    await page.fill('.journal-search input', '')
    await page.wait_for_timeout(300)
    await page.click('.entry .ink-link >> text=keep')
    await page.wait_for_timeout(200)
    check('keep from journal', len(await ls(page, f'user:{uid}:kept')) == 2)
    await page.click('.entry .ink-link >> text=unfold')
    await page.wait_for_timeout(1200)
    check('unfold opens paper', await page.locator('.ritual.mode-paper .fortune-text.is-shown').count() == 1)
    await page.keyboard.press('Escape')
    await page.wait_for_timeout(400)

    # ---- sign out / log in
    await page.click('.account-tag', force=True)
    await page.wait_for_selector('.panel.account-panel')
    await page.screenshot(path=f'{OUT}/{VP}-08-account.png')
    await page.click('.account-actions .ink-link')
    await page.wait_for_timeout(500)
    check('signed out', 'Sign up' in await page.locator('.plaque-text').inner_text())
    await page.click('button.jar')
    await page.wait_for_selector('.panel.account-panel')
    check('guest still out of free after sign out', True)
    await page.click('.account-switch button >> nth=1')
    await page.fill('.account-form input[type=email]', 'mei@example.com')
    await page.fill('.account-form input[type=password]', 'wrongpass1')
    await page.click('.account-form button[type=submit]')
    await page.wait_for_timeout(1200)
    check('wrong password rejected', 'does not match' in await page.locator('.form-error').inner_text())
    await page.fill('.account-form input[type=password]', 'teatime123')
    await page.click('.account-form button[type=submit]')
    await page.wait_for_selector('.panel.account-panel', state='detached', timeout=6000)
    check('logged back in, journal intact', 'Mei' in await page.locator('.plaque-text').inner_text() and await page.locator('.journal-count').inner_text() == '2')

    # ---- refresh mid-ritual keeps the cookie
    await page.wait_for_timeout(3800)
    await page.click('button.jar')
    await page.wait_for_timeout(1200)
    await page.reload()
    await page.wait_for_timeout(1000)
    check('hint says cookie waiting', 'waiting' in await page.locator('.jar-hint span').inner_text())
    await page.click('button.jar')
    await page.wait_for_timeout(600)
    check('waiting cookie offered', await page.locator('.ritual.mode-cookie').count() == 1)
    await open_fortune(page)

    check('no console errors', not errors, errors)

async def main():
    w, h, mobile = SIZES[VP]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile)
        await ctx.add_init_script(INIT)
        page = await ctx.new_page()
        errors = []
        page.on('console', lambda m: m.type in ('error', 'warning') and errors.append(f'console {m.type}: {m.text}'))
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('response', lambda r: r.status >= 400 and errors.append(f'{r.status}: {r.url}'))
        try:
            await run(page, errors)
        finally:
            for r in results:
                print(*r)
        await b.close()
    print(f"{sum(r[0] == 'PASS' for r in results)}/{len(results)} passed")

asyncio.run(main())
