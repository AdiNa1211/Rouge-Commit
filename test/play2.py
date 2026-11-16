# Faster checks: steps the sim directly so software rendering speed does not matter.
import sys
from playwright.sync_api import sync_playwright
out = 'test/shots'; errors = []
role = sys.argv[1] if len(sys.argv) > 1 else 'staff'
FAST = "(n) => { const g = __app.game; for (let i = 0; i < n && g.phase !== 'ended'; i++) g.update(0.05); return [g.phase, g.time.toFixed(0), g.meeting && g.meeting.phase]; }"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_page(viewport={'width': 1280, 'height': 760})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto('file:///home/claude/rogue-commit/dist/index.html')
    pg.wait_for_timeout(1500)
    pg.click(f'.seg[data-id="{role}"]'); pg.click('text=Clock in'); pg.wait_for_timeout(400)
    pg.mouse.click(640, 200); pg.wait_for_timeout(400)
    print('after 12s', pg.evaluate(FAST, 240))
    pg.wait_for_timeout(700); pg.screenshot(path=f'{out}/a-play-{role}.png')
    if role == 'mole':
        pg.evaluate('() => { __app.game.sabCd = 0; }'); pg.keyboard.press('KeyX'); pg.wait_for_timeout(400); pg.screenshot(path=f'{out}/b-toolkit.png')
        pg.evaluate("() => { const g = __app.game; if (g.sabotage) g.clearSabotage(null, true); g.sabCd = 0; __app.modal.el._tick(); document.querySelector('.sab').click(); }")
        pg.wait_for_timeout(1200); pg.screenshot(path=f'{out}/c-outage.png')
        # walk up to a colleague and eliminate
        print('kill', pg.evaluate("""() => { const g = __app.game, me = g.human; me.cd.kill = 0; const t = g.living('staff')[0]; me.pos.x = t.pos.x + 0.8; me.pos.z = t.pos.z; return t.id; }"""))
        pg.wait_for_timeout(500); pg.keyboard.press('KeyQ'); pg.wait_for_timeout(900); pg.screenshot(path=f'{out}/d-kill.png')
    else:
        pg.evaluate("() => { const g = __app.game, me = g.human; const st = g.stations.cams; me.pos.x = st.x; me.pos.z = st.z; }")
        pg.wait_for_timeout(500); pg.keyboard.press('KeyE'); pg.wait_for_timeout(600)
        pg.click('button[data-cam="cam-dev"]'); pg.wait_for_timeout(900); pg.screenshot(path=f'{out}/b-cams.png')
        pg.keyboard.press('Escape')
        pg.evaluate("() => { const g = __app.game, me = g.human; const st = g.stations.logs; me.pos.x = st.x; me.pos.z = st.z; }")
        pg.wait_for_timeout(500); pg.keyboard.press('KeyE'); pg.wait_for_timeout(500); pg.screenshot(path=f'{out}/c-logs.png')
        pg.keyboard.press('Escape')
    # run until a meeting happens, then watch it
    for i in range(60):
        ph = pg.evaluate(FAST, 200)
        if ph[0] != 'play': break
    print('state', ph)
    CLICK = "(sel) => { const e = document.querySelector(sel); if (e && !e.disabled) e.click(); return !!e; }"
    if ph[0] == 'meeting':
        pg.evaluate(FAST, 300)
        pg.evaluate(CLICK, '.m-card:not(.gone):not(.me)'); pg.evaluate(CLICK, '.m-actions .btn.danger')
        pg.evaluate(FAST, 100); pg.wait_for_timeout(500); pg.screenshot(path=f'{out}/e-meeting.png')
        pg.evaluate("() => { __app.game.meeting.left = 0.05; }"); pg.evaluate(FAST, 60)
        pg.evaluate(CLICK, '.m-card:not(.gone):not(.me)'); pg.evaluate(CLICK, '.m-actions .btn.danger')
        pg.evaluate(FAST, 480); pg.wait_for_timeout(400); pg.screenshot(path=f'{out}/f-results.png')
    for i in range(400):
        ph = pg.evaluate(FAST, 400)
        if ph[0] == 'ended': break
    print('final', ph, pg.evaluate("() => __app.game.result"))
    pg.wait_for_timeout(2600); pg.screenshot(path=f'{out}/g-end.png')
    print('errors:', errors[:10])
    b.close()
