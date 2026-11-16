# Drives the built game in headless Chrome and saves screenshots of each screen.
import sys, time
from playwright.sync_api import sync_playwright

out = 'test/shots'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
                          args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 860})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto('file:///home/claude/rogue-commit/dist/index.html')
    pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{out}/1-menu.png')
    role = sys.argv[1] if len(sys.argv) > 1 else 'staff'
    pg.click(f'.seg[data-id="{role}"]')
    pg.click('text=Clock in')
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{out}/2-reveal.png')
    pg.mouse.click(720, 300); pg.wait_for_timeout(5500)
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(1800); pg.keyboard.up('KeyW')
    pg.screenshot(path=f'{out}/3-play.png')
    # jump to the first ticket and open its minigame
    pg.evaluate("""() => { const a = __app, g = a.game, me = g.human; const st = g.stations[me.tasks[0].station]; me.pos.x = st.x; me.pos.z = st.z; }""")
    pg.wait_for_timeout(500)
    pg.keyboard.press('KeyE')
    pg.wait_for_timeout(500)
    pg.screenshot(path=f'{out}/4-minigame.png')
    pg.keyboard.press('Escape')
    pg.evaluate("""() => { const g = __app.game, me = g.human; const st = g.stations.cams; me.pos.x = st.x; me.pos.z = st.z; }""")
    pg.wait_for_timeout(400)
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(700)
    pg.screenshot(path=f'{out}/5-cams.png')
    pg.keyboard.press('Escape')
    pg.evaluate("""() => { const g = __app.game; const m = g.agents.find(a => a.role === 'mole' && !a.isHuman); g.sabCd = 0; g.command(m.id, { type: 'sabotage', id: 'outage' }); }""")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{out}/6-sabotage.png')
    pg.evaluate("""() => { const g = __app.game; g.command(g.human.id, { type: 'pager' }) || g.startMeeting({ kind: 'pager', by: g.human.id }); }""")
    pg.wait_for_timeout(9000)
    pg.screenshot(path=f'{out}/7-meeting.png')
    pg.evaluate("""() => { __app.game.meeting.left = 0.1; }""")
    pg.wait_for_timeout(8000)
    pg.screenshot(path=f'{out}/8-voting.png')
    pg.evaluate("""() => { __app.game.meeting.left = 0.1; }""")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{out}/9-results.png')
    pg.wait_for_timeout(8000)
    pg.screenshot(path=f'{out}/10-after.png')
    pg.evaluate("""() => { const g = __app.game; g.exfil = 100; }""")
    pg.wait_for_timeout(3000)
    pg.screenshot(path=f'{out}/11-end.png')
    print('fps probe / errors:', errors[:12])
    b.close()
