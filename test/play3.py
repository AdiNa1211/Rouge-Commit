from playwright.sync_api import sync_playwright
out = 'test/shots'; errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_page(viewport={'width': 1280, 'height': 760})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.goto('file:///home/claude/rogue-commit/dist/index.html'); pg.wait_for_timeout(1200)
    pg.click('.seg[data-id="mole"]'); pg.click('text=Clock in'); pg.wait_for_timeout(300)
    pg.mouse.click(640, 200); pg.wait_for_timeout(300)
    print(pg.evaluate("""() => { const a = __app, g = a.game, me = g.human; a.view.dist = 6; a.view.pitch = 0.6;
      for (let i = 0; i < 20; i++) g.update(0.05);
      me.cd.kill = 0; const t = g.living('staff').find(x => x.id === 'hana') || g.living('staff')[0];
      t.pos.x = 33; t.pos.z = 45; t.brain.state = 'idle'; t.brain.wait = 99; me.pos.x = 33.9; me.pos.z = 45; g.trackRooms(); const ok = a.cmd({ type: 'kill', target: t.id });
      me.pos.x += 0.6; me.facing = -1.2; return [ok, t.id, g.bodies.length, me.cd.kill]; }"""))
    pg.wait_for_timeout(1500); pg.screenshot(path=f'{out}/h-body.png')
    print(pg.evaluate("() => [__app.game.phase, __app.game.meeting && __app.game.meeting.ctx.kind]"))
    print('errors', errors[:8]); b.close()
