# Two browsers in one online room: lobby, start, movement sync, a paged meeting, votes.
from playwright.sync_api import sync_playwright
out = 'test/shots'; errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pages = []
    for i in range(2):
        pg = b.new_page(viewport={'width': 1100, 'height': 680})
        pg.on('console', lambda m, i=i: errors.append(f'p{i} {m.text}') if m.type == 'error' else None)
        pg.on('pageerror', lambda e, i=i: errors.append(f'p{i} PAGEERROR {e}'))
        pg.goto('http://localhost:8090/'); pg.wait_for_timeout(1200); pages.append(pg)
    a, c = pages
    a.click('text=Create a room'); a.wait_for_timeout(800)
    code = a.inner_text('.code'); print('room', code)
    c.click('.pick[data-id="leo"]'); c.fill('#room-code', code); c.click('text=Join'); c.wait_for_timeout(800)
    a.screenshot(path=f'{out}/mp-lobby.png')
    a.click('text=Start match'); a.wait_for_timeout(1500)
    for pg in pages: pg.mouse.click(550, 150)
    info = lambda pg: pg.evaluate("() => { const g = __app.game, me = g.human; return [me.id, me.role, me.pos.x.toFixed(1), me.pos.z.toFixed(1), g.time.toFixed(0), g.phase, g.taskTotal, __app.remote]; }")
    print('start', info(a), info(c))
    a.keyboard.down('KeyW'); c.keyboard.down('KeyD'); a.wait_for_timeout(2500); a.keyboard.up('KeyW'); c.keyboard.up('KeyD'); a.wait_for_timeout(800)
    print('moved', info(a), info(c))
    # each client's view of the other player should match that player's own position
    seen = lambda pg, who: pg.evaluate("(id) => { const x = __app.game.agent(id); return [x.pos.x.toFixed(1), x.pos.z.toFixed(1)]; }", who)
    print('a sees leo at', seen(a, 'leo'), ' c sees', info(a)[0], 'at', seen(c, info(a)[0]))
    a.wait_for_timeout(20000)
    a.keyboard.press('KeyC'); a.wait_for_timeout(2500)
    print('meeting', info(a)[5], info(c)[5], a.evaluate("() => __app.game.meeting && __app.game.meeting.ctx.kind"))
    a.screenshot(path=f'{out}/mp-meeting.png'); c.screenshot(path=f'{out}/mp-play2.png')
    c.fill('#m-say', 'where were you Priya?'); c.keyboard.press('Enter'); c.wait_for_timeout(1500)
    print('chat a', a.evaluate("() => __app.game.meeting && __app.game.meeting.chat.map(l => l.text).slice(-3)"))
    print('errors', errors[:10]); b.close()
