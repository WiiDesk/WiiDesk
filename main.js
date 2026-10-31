const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { listApps } = require('./desktop-apps');
const systemControl = require('./system-control');

let win = null;

// The Home key (Super, bound in session/openbox-rc.xml) runs session/wiidesk-home,
// which finds this process through the pid file and sends it SIGUSR2.
const PIDFILE = path.join(process.env.XDG_RUNTIME_DIR || '/tmp', `wiidesk-${process.getuid()}.pid`);

function showHomeMenu() {
    if (!win) return;
    // Tell the renderer whether an app was in front, so it can return there when the menu closes
    const overApp = !win.isFocused();
    win.show();
    win.focus();
    win.webContents.send('home-button', overApp);
}

// While WiiDesk is minimized behind an app, bring it back as soon as that app has quit
// (otherwise the screen would stay empty). Counts the windows the window manager manages.
let emptyDesktopTimer = null;
function watchForEmptyDesktop() {
    clearInterval(emptyDesktopTimer);
    emptyDesktopTimer = setInterval(() => {
        // isMinimized() is unreliable under X11, so stop once WiiDesk has the focus again
        if (!win || win.isFocused()) return clearInterval(emptyDesktopTimer);
        execFile('obxprop', ['--root', '_NET_CLIENT_LIST'], (err, out) => {
            if (err || !win || win.isFocused()) return;
            // Output looks like: _NET_CLIENT_LIST(WINDOW) = 4194307, 16777228
            const ids = (out.split('=')[1] || '').split(',').filter((id) => id.trim());
            if (ids.length <= 1) {
                win.restore();
                win.show();
                win.focus();
            }
        });
    }, 1000);
}

function createWindow() {
    win = new BrowserWindow({
        fullscreen: true,
        frame: false,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets', 'favicon.png'),
        webPreferences: {
            // The renderer calls require('electron') and require('fs') directly (script.js, storage.js)
            nodeIntegration: true,
            contextIsolation: false,
            autoplayPolicy: 'no-user-gesture-required'
        }
    });

    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'index.html'));

    // Lets the renderer pause/resume the background music
    win.on('blur', () => win.webContents.send('window-blur'));
    win.on('focus', () => win.webContents.send('window-focus'));

    // Emergency exit / logout: Ctrl+Alt+Q quits WiiDesk
    win.webContents.on('before-input-event', (e, input) => {
        if (input.type === 'keyDown' && input.control && input.alt && input.key.toLowerCase() === 'q') {
            app.quit();
        }
    });

    win.on('closed', () => { win = null; });
}

// Start a detached process; resolves once it has spawned (or failed to)
function run(cmd, args) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        child.once('error', (err) => resolve({ ok: false, error: err.message, code: err.code }));
        child.once('spawn', () => { child.unref(); resolve({ ok: true }); });
    });
}

// Launch a program. target = shell command, executable path or .desktop file
ipcMain.handle('launch', async (e, target) => {
    if (!target || typeof target !== 'string') return { ok: false, error: 'no target given' };

    if (target.endsWith('.desktop')) {
        // gio handles Exec field codes, Terminal=true and so on; gtk-launch is the fallback
        const result = await run('gio', ['launch', target]);
        if (result.ok || result.code !== 'ENOENT') return result;
        return run('gtk-launch', [path.basename(target, '.desktop')]);
    }
    return run('/bin/sh', ['-c', target]);
});

// Installed applications, so the renderer can create a channel for each one
ipcMain.handle('list-apps', (e, skipIconIds) => listApps(skipIconIds));

// Log out: quitting WiiDesk ends the session (see session/wiidesk-session)
ipcMain.handle('logout', () => { app.quit(); });

// Restart / shut down / suspend. Each action tries these commands in order:
// loginctl works with systemd and elogind, the rest are fallbacks for other setups.
const POWER_COMMANDS = {
    poweroff: [['loginctl', 'poweroff'], ['systemctl', 'poweroff'], ['poweroff']],
    reboot: [['loginctl', 'reboot'], ['systemctl', 'reboot'], ['reboot']],
    suspend: [['loginctl', 'suspend'], ['systemctl', 'suspend']]
};

ipcMain.handle('power', async (e, kind) => {
    const commands = POWER_COMMANDS[kind];
    if (!commands) return { ok: false, error: 'unknown action' };
    for (const [cmd, ...args] of commands) {
        const ok = await new Promise((resolve) => execFile(cmd, args, (err) => resolve(!err)));
        if (ok) return { ok: true };
    }
    return { ok: false, error: 'no way to ' + kind + ' found' };
});

// Volume, brightness, Wi-Fi and Bluetooth for the Wii settings
systemControl.register(ipcMain);

// Open a website in the default browser (http/https only)
ipcMain.handle('open-site', async (e, url) => {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http(s) allowed');
        await shell.openExternal(u.href);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

// --- Password prompts of the system (polkit) ---
// polkit-agent/wiidesk-polkit-agent.py talks to polkit; WiiDesk only shows the Wii-style dialog.
let polkitAgent = null;
let authOverApp = false;

function startPolkitAgent() {
    const script = path.join(__dirname, 'polkit-agent', 'wiidesk-polkit-agent.py');
    if (!fs.existsSync(script)) return;
    polkitAgent = spawn('python3', [script], { stdio: ['pipe', 'pipe', 'inherit'] });
    polkitAgent.on('error', (err) => { console.error('polkit agent:', err.message); polkitAgent = null; });
    polkitAgent.on('exit', () => { polkitAgent = null; });
    readline.createInterface({ input: polkitAgent.stdout }).on('line', handlePolkitMessage);
}

function handlePolkitMessage(line) {
    let msg;
    try { msg = JSON.parse(line); } catch (e) { return; }
    if (msg.type === 'fatal') return console.error('polkit agent:', msg.text);
    if (!win) return;

    if (msg.type === 'begin') {
        // Show the dialog on top of whatever is running
        authOverApp = !win.isFocused();
        win.show();
        win.focus();
    }
    win.webContents.send('polkit', msg);

    // Finished: go back to the app that asked for the password
    if ((msg.type === 'done' || msg.type === 'cancel') && authOverApp) {
        authOverApp = false;
        win.minimize();
        watchForEmptyDesktop();
    }
}

ipcMain.on('polkit-reply', (e, msg) => {
    if (polkitAgent && polkitAgent.stdin.writable) polkitAgent.stdin.write(JSON.stringify(msg) + '\n');
});

// The pause menu was closed: go back to the app it was opened over
ipcMain.handle('home-closed', (e, overApp) => {
    if (!overApp || !win) return;
    win.minimize();
    watchForEmptyDesktop();
});

process.on('SIGUSR2', showHomeMenu);

app.whenReady().then(() => {
    try { fs.writeFileSync(PIDFILE, String(process.pid)); } catch (e) { console.error('pid file:', e.message); }
    createWindow();
    startPolkitAgent();
});
app.on('will-quit', () => {
    try { fs.unlinkSync(PIDFILE); } catch (e) {}
    if (polkitAgent) polkitAgent.kill();
});
app.on('window-all-closed', () => app.quit());
