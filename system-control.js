// System controls for the Wii settings: volume (pactl), brightness (brightnessctl),
// Wi-Fi (nmcli) and Bluetooth (bluetoothctl). Every call returns { ok, ... } and never throws,
// so the UI can simply show "not available" when a tool is missing.
const { execFile, spawn } = require('child_process');

function run(cmd, args, opts) {
    return new Promise((resolve) => {
        execFile(cmd, args, Object.assign({ timeout: 15000, maxBuffer: 1 << 20 }, opts), (err, stdout, stderr) => {
            if (err) {
                const code = err.code === 'ENOENT' ? 'missing' : 'failed';
                resolve({ ok: false, code, error: (stderr || err.message || '').trim() });
            } else {
                resolve({ ok: true, out: stdout });
            }
        });
    });
}

const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

// ---- Volume ----------------------------------------------------------------------------------
async function getVolume() {
    const vol = await run('pactl', ['get-sink-volume', '@DEFAULT_SINK@']);
    if (!vol.ok) return { ok: false, code: vol.code, error: vol.error };
    const mute = await run('pactl', ['get-sink-mute', '@DEFAULT_SINK@']);
    const m = vol.out.match(/(\d+)%/);
    return { ok: true, volume: m ? parseInt(m[1], 10) : 0, muted: mute.ok && /yes/i.test(mute.out) };
}

async function setVolume(pct) {
    return run('pactl', ['set-sink-volume', '@DEFAULT_SINK@', clampPct(pct) + '%']);
}

async function toggleMute() {
    return run('pactl', ['set-sink-mute', '@DEFAULT_SINK@', 'toggle']);
}

// ---- Brightness ------------------------------------------------------------------------------
async function getBrightness() {
    const r = await run('brightnessctl', ['-m']);
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    // machine format: device,class,current,percent%,max
    const m = r.out.trim().split(',')[3];
    if (!m) return { ok: false, code: 'none', error: 'no backlight found' };
    return { ok: true, brightness: parseInt(m, 10) };
}

async function setBrightness(pct) {
    // never go fully black, the screen would be unusable
    return run('brightnessctl', ['set', Math.max(5, clampPct(pct)) + '%']);
}

// ---- Wi-Fi -----------------------------------------------------------------------------------
// nmcli -t separates fields with ':' and escapes literal ':' as '\:'
function splitTerse(line) {
    const out = [];
    let cur = '';
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\' && i + 1 < line.length) { cur += line[++i]; }
        else if (line[i] === ':') { out.push(cur); cur = ''; }
        else cur += line[i];
    }
    out.push(cur);
    return out;
}

async function wifiStatus() {
    const radio = await run('nmcli', ['radio', 'wifi']);
    if (!radio.ok) return { ok: false, code: radio.code, error: radio.error };
    return { ok: true, enabled: /enabled/i.test(radio.out) };
}

async function wifiSetEnabled(on) {
    return run('nmcli', ['radio', 'wifi', on ? 'on' : 'off']);
}

async function wifiList(rescan) {
    const r = await run('nmcli', ['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', rescan ? 'yes' : 'auto']);
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    const saved = await run('nmcli', ['-t', '-f', 'NAME,TYPE', 'connection', 'show']);
    const known = new Set();
    if (saved.ok) saved.out.split('\n').forEach((l) => {
        const [name, type] = splitTerse(l);
        if (name && /wireless/.test(type || '')) known.add(name);
    });
    const best = new Map();
    r.out.split('\n').filter(Boolean).forEach((l) => {
        const [inUse, ssid, signal, security] = splitTerse(l);
        if (!ssid) return; // hidden networks
        const net = { ssid, signal: parseInt(signal, 10) || 0, secure: !!security && security !== '--', connected: inUse === '*', saved: known.has(ssid) };
        const old = best.get(ssid);
        if (!old || net.connected || (!old.connected && net.signal > old.signal)) best.set(ssid, net);
    });
    return { ok: true, networks: [...best.values()].sort((a, b) => (b.connected - a.connected) || (b.signal - a.signal)) };
}

// Password goes through stdin (--ask), not the command line, so it does not show up in `ps`
function wifiConnect(ssid, password) {
    if (typeof ssid !== 'string' || !ssid) return Promise.resolve({ ok: false, error: 'no network given' });
    return new Promise((resolve) => {
        const args = password ? ['--ask', '-w', '30', 'dev', 'wifi', 'connect', ssid] : ['-w', '30', 'dev', 'wifi', 'connect', ssid];
        const child = spawn('nmcli', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        let err = '';
        child.stderr.on('data', (d) => { err += d; });
        child.on('error', (e) => resolve({ ok: false, code: e.code === 'ENOENT' ? 'missing' : 'failed', error: e.message }));
        child.on('close', async (code) => {
            if (code === 0) return resolve({ ok: true });
            // A failed attempt with a password leaves a profile with the wrong password behind
            if (password) await run('nmcli', ['connection', 'delete', 'id', ssid]);
            resolve({ ok: false, error: err.trim() || 'connection failed' });
        });
        if (password) child.stdin.write(password + '\n');
        child.stdin.end();
    });
}

async function wifiDisconnect() {
    const dev = await run('nmcli', ['-t', '-f', 'DEVICE,TYPE,STATE', 'device']);
    if (!dev.ok) return dev;
    const wifi = dev.out.split('\n').map(splitTerse).find((f) => f[1] === 'wifi' && f[2] === 'connected');
    if (!wifi) return { ok: true };
    return run('nmcli', ['device', 'disconnect', wifi[0]]);
}

// ---- Bluetooth -------------------------------------------------------------------------------
const MAC = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

async function btStatus() {
    const r = await run('bluetoothctl', ['show']);
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    if (/No default controller/i.test(r.out)) return { ok: false, code: 'none', error: 'no bluetooth adapter found' };
    return { ok: true, enabled: /Powered:\s*yes/i.test(r.out) };
}

async function btSetEnabled(on) {
    return run('bluetoothctl', ['power', on ? 'on' : 'off']);
}

async function btList(scan) {
    if (scan) await run('bluetoothctl', ['--timeout', '6', 'scan', 'on'], { timeout: 12000 });
    const r = await run('bluetoothctl', ['devices']);
    if (!r.ok) return { ok: false, code: r.code, error: r.error };
    const devices = [];
    for (const line of r.out.split('\n')) {
        const m = line.match(/^Device\s+(\S+)\s+(.+)$/);
        if (!m || !MAC.test(m[1])) continue;
        const info = await run('bluetoothctl', ['info', m[1]]);
        const has = (key) => info.ok && new RegExp(key + ':\\s*yes', 'i').test(info.out);
        // devices without a real name are just their address: hide them
        if (m[2].replace(/-/g, ':').toUpperCase() === m[1].toUpperCase()) continue;
        devices.push({ mac: m[1], name: m[2], paired: has('Paired'), connected: has('Connected') });
    }
    devices.sort((a, b) => (b.connected - a.connected) || (b.paired - a.paired) || a.name.localeCompare(b.name));
    return { ok: true, devices };
}

async function btConnect(mac) {
    if (!MAC.test(mac)) return { ok: false, error: 'invalid address' };
    return run('bluetoothctl', ['connect', mac], { timeout: 25000 });
}

async function btDisconnect(mac) {
    if (!MAC.test(mac)) return { ok: false, error: 'invalid address' };
    return run('bluetoothctl', ['disconnect', mac]);
}

async function btRemove(mac) {
    if (!MAC.test(mac)) return { ok: false, error: 'invalid address' };
    return run('bluetoothctl', ['remove', mac]);
}

// Pairing needs a registered agent, which one-shot bluetoothctl commands do not have, so this
// drives one interactive bluetoothctl session (just-works pairing; PIN entry is not supported).
function btPair(mac) {
    if (!MAC.test(mac)) return Promise.resolve({ ok: false, error: 'invalid address' });
    return new Promise((resolve) => {
        const child = spawn('bluetoothctl', [], { stdio: ['pipe', 'pipe', 'pipe'] });
        let buf = '', done = false, stage = 'pair';
        const finish = (res) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try { child.stdin.write('quit\n'); child.stdin.end(); } catch (e) { /* already closed */ }
            setTimeout(() => child.kill(), 500);
            resolve(res);
        };
        const timer = setTimeout(() => finish({ ok: false, error: 'pairing timed out' }), 40000);
        const feed = (d) => {
            buf += d.toString();
            if (stage === 'pair' && /Pairing successful|AlreadyExists|Already paired/i.test(buf)) {
                stage = 'connect';
                buf = '';
                child.stdin.write('trust ' + mac + '\nconnect ' + mac + '\n');
            } else if (stage === 'pair' && /Failed to pair|AuthenticationFailed|AuthenticationCanceled|not available/i.test(buf)) {
                finish({ ok: false, error: 'pairing failed' });
            } else if (stage === 'connect' && /Connection successful/i.test(buf)) {
                finish({ ok: true });
            } else if (stage === 'connect' && /Failed to connect/i.test(buf)) {
                // paired and trusted, only the connection failed
                finish({ ok: false, error: 'paired, but could not connect' });
            }
        };
        child.stdout.on('data', feed);
        child.stderr.on('data', feed);
        child.on('error', (e) => finish({ ok: false, code: e.code === 'ENOENT' ? 'missing' : 'failed', error: e.message }));
        child.on('close', () => finish({ ok: false, error: 'bluetoothctl closed' }));
        child.stdin.write('power on\nagent NoInputNoOutput\ndefault-agent\npair ' + mac + '\n');
    });
}

// Registers all handlers on ipcMain
function register(ipcMain) {
    const h = (name, fn) => ipcMain.handle(name, (e, ...args) => fn(...args));
    h('sys-volume-get', getVolume);
    h('sys-volume-set', setVolume);
    h('sys-mute-toggle', toggleMute);
    h('sys-brightness-get', getBrightness);
    h('sys-brightness-set', setBrightness);
    h('sys-wifi-status', wifiStatus);
    h('sys-wifi-enable', wifiSetEnabled);
    h('sys-wifi-list', wifiList);
    h('sys-wifi-connect', wifiConnect);
    h('sys-wifi-disconnect', wifiDisconnect);
    h('sys-bt-status', btStatus);
    h('sys-bt-enable', btSetEnabled);
    h('sys-bt-list', btList);
    h('sys-bt-connect', btConnect);
    h('sys-bt-disconnect', btDisconnect);
    h('sys-bt-remove', btRemove);
    h('sys-bt-pair', btPair);
}

module.exports = { register, splitTerse };
