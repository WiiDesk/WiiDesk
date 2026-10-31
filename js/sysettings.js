// Wii settings pages for the desktop: volume, brightness, Wi-Fi and Bluetooth.
// The work is done by system-control.js in the main process (pactl, brightnessctl, nmcli, bluetoothctl).

(function () {
    var ipc = window.electronIpc;
    var current = 'root';

    function sfx(name) { playSFX(name, userConfig.sfxVol); }
    function el(id) { return document.getElementById(id); }
    function call(channel) {
        if (!ipc) return Promise.resolve({ ok: false, code: 'missing' });
        return ipc.invoke.apply(ipc, arguments).catch(function (e) { return { ok: false, error: String(e) }; });
    }

    function pageEl(name) { return document.querySelector('.set-page[data-page="' + name + '"]'); }

    // ---- Page navigation -------------------------------------------------------------------
    window.settingsOpenPage = function (name) {
        current = name;
        document.querySelectorAll('#settingsView .set-page').forEach(function (p) { p.style.display = 'none'; });
        var page = pageEl(name);
        page.style.display = 'flex';
        if (name === 'volume') initVolume();
        if (name === 'wifi') initWifi();
        if (name === 'bluetooth') initBluetooth();
    };

    // Returns true when it went back to the settings list, false when already there
    window.settingsBack = function () {
        if (current === 'root') return false;
        settingsOpenPage('root');
        return true;
    };

    // This script is loaded in <head>, so wire the page once the markup exists
    document.addEventListener('DOMContentLoaded', function () {
        if (!ipc) document.querySelectorAll('.desktop-only').forEach(function (n) { n.style.display = 'none'; });

        document.querySelectorAll('#settingsRoot .set-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                sfx('button-select-big.mp3');
                settingsOpenPage(b.getAttribute('data-goto'));
            });
        });
        document.querySelectorAll('#settingsView .set-btn, #settingsView .set-pill').forEach(function (b) {
            b.addEventListener('mouseenter', function () { sfx('button-hover.mp3'); });
        });
    });

    function setNote(id, text) { el(id).textContent = text || ''; }

    // ---- Volume & brightness ---------------------------------------------------------------
    var sysTimer = null, briTimer = null, volReady = false;

    function bindConfigSlider(id, key) {
        var input = el(id), val = el(id + 'Val');
        input.value = userConfig[key];
        val.textContent = Math.round(input.value * 100) + '%';
        input.oninput = function () {
            userConfig[key] = input.value;
            val.textContent = Math.round(input.value * 100) + '%';
            WiiDeskStorage.save('wiidesk-settings', userConfig);
        };
    }

    function paintMute(muted) { el('sysMute').textContent = muted ? 'Unmute' : 'Mute'; }

    function initVolume() {
        bindConfigSlider('sfxVolume', 'sfxVol');
        bindConfigSlider('musicVolume', 'musicVol');
        if (!ipc) return;
        setNote('volumeNote', '');
        call('sys-volume-get').then(function (r) {
            el('rowSysVolume').style.display = r.ok ? 'flex' : 'none';
            if (!r.ok) {
                setNote('volumeNote', r.code === 'missing' ? "System volume isn't available (pactl not found)." : "System volume isn't available.");
                return;
            }
            el('sysVolume').value = r.volume;
            el('sysVolumeVal').textContent = r.volume + '%';
            paintMute(r.muted);
        });
        call('sys-brightness-get').then(function (r) {
            el('rowBrightness').style.display = r.ok ? 'flex' : 'none';
            if (r.ok) {
                el('sysBrightness').value = r.brightness;
                el('sysBrightnessVal').textContent = r.brightness + '%';
            }
        });
        if (volReady) return;
        volReady = true;
        el('sysVolume').addEventListener('input', function () {
            var v = el('sysVolume').value;
            el('sysVolumeVal').textContent = v + '%';
            clearTimeout(sysTimer);
            sysTimer = setTimeout(function () { call('sys-volume-set', Number(v)); }, 60);
        });
        el('sysMute').addEventListener('click', function () {
            sfx('button-select.mp3');
            call('sys-mute-toggle').then(function () { return call('sys-volume-get'); }).then(function (r) { if (r.ok) paintMute(r.muted); });
        });
        el('sysBrightness').addEventListener('input', function () {
            var v = el('sysBrightness').value;
            el('sysBrightnessVal').textContent = v + '%';
            clearTimeout(briTimer);
            briTimer = setTimeout(function () { call('sys-brightness-set', Number(v)); }, 60);
        });
    }

    // ---- Generic list row ------------------------------------------------------------------
    // Built with textContent only: network and device names come from the outside world
    function row(label, detail, onClick, extra) {
        var a = document.createElement('a');
        a.className = 'set-item';
        var name = document.createElement('span');
        name.className = 'set-item-name';
        name.textContent = label;
        var info = document.createElement('span');
        info.className = 'set-item-info';
        info.textContent = detail || '';
        a.appendChild(name);
        a.appendChild(info);
        if (extra) a.appendChild(extra);
        a.addEventListener('mouseenter', function () { sfx('button-hover.mp3'); });
        a.addEventListener('click', function () { sfx('button-select.mp3'); onClick(); });
        return a;
    }

    // ---- Wi-Fi -----------------------------------------------------------------------------
    var wifiOn = false, wifiBusy = false, wifiReady = false;

    function wifiRender(networks) {
        var list = el('wifiList');
        list.textContent = '';
        if (!networks.length) { setNote('wifiNote', 'No networks found.'); return; }
        networks.forEach(function (n) {
            var detail = (n.connected ? 'Connected' : (n.saved ? 'Saved' : '')) + (n.secure ? (n.connected || n.saved ? ' · ' : '') + 'Secured' : '') + ' · ' + n.signal + '%';
            list.appendChild(row(n.ssid, detail.replace(/^ · /, ''), function () { wifiClick(n); }));
        });
    }

    function wifiRefresh(rescan) {
        el('wifiList').textContent = '';
        setNote('wifiNote', 'Searching…');
        return call('sys-wifi-list', !!rescan).then(function (r) {
            if (!r.ok) { setNote('wifiNote', r.error || "Couldn't list networks."); return; }
            setNote('wifiNote', '');
            wifiRender(r.networks);
        });
    }

    function wifiPaint() {
        el('wifiState').textContent = wifiOn ? 'WLAN is on' : 'WLAN is off';
        el('wifiToggle').textContent = wifiOn ? 'Turn off' : 'Turn on';
        el('wifiScan').style.display = wifiOn ? '' : 'none';
        if (!wifiOn) { el('wifiList').textContent = ''; setNote('wifiNote', ''); }
    }

    function wifiConnect(n, password) {
        wifiBusy = true;
        setNote('wifiNote', 'Connecting to ' + n.ssid + '…');
        call('sys-wifi-connect', n.ssid, password || null).then(function (r) {
            wifiBusy = false;
            if (r.ok) { wifiRefresh(false); return; }
            wifiRefresh(false).then(function () { setNote('wifiNote', "Couldn't connect to " + n.ssid + (password ? ' (wrong password?)' : '.')); });
        });
    }

    function wifiClick(n) {
        if (wifiBusy) return;
        if (n.connected) {
            wifiBusy = true;
            call('sys-wifi-disconnect').then(function () { wifiBusy = false; wifiRefresh(false); });
        } else if (n.secure && !n.saved) {
            askPassword(n.ssid, 'Password', function (pw) { if (pw) wifiConnect(n, pw); });
        } else {
            wifiConnect(n);
        }
    }

    function initWifi() {
        el('wifiToggle').style.display = el('wifiScan').style.display = '';
        el('wifiList').textContent = '';
        setNote('wifiNote', '');
        call('sys-wifi-status').then(function (r) {
            if (!r.ok) {
                el('wifiState').textContent = 'WLAN';
                el('wifiToggle').style.display = el('wifiScan').style.display = 'none';
                setNote('wifiNote', r.code === 'missing' ? "WLAN isn't available (NetworkManager / nmcli not found)." : "WLAN isn't available.");
                return;
            }
            wifiOn = r.enabled;
            wifiPaint();
            if (wifiOn) wifiRefresh(false);
        });
        if (wifiReady) return;
        wifiReady = true;
        el('wifiToggle').addEventListener('click', function () {
            sfx('button-select.mp3');
            call('sys-wifi-enable', !wifiOn).then(function (r) {
                if (!r.ok) { setNote('wifiNote', r.error || "Couldn't switch WLAN."); return; }
                wifiOn = !wifiOn;
                wifiPaint();
                // the adapter needs a moment before it sees networks
                if (wifiOn) setTimeout(function () { wifiRefresh(true); }, 2500);
            });
        });
        el('wifiScan').addEventListener('click', function () { sfx('button-select.mp3'); wifiRefresh(true); });
    }

    // ---- Bluetooth -------------------------------------------------------------------------
    var btOn = false, btBusy = false, btReady = false;

    function btAction(d) {
        if (btBusy) return;
        btBusy = true;
        var channel = d.connected ? 'sys-bt-disconnect' : (d.paired ? 'sys-bt-connect' : 'sys-bt-pair');
        setNote('btNote', (d.connected ? 'Disconnecting ' : (d.paired ? 'Connecting to ' : 'Pairing with ')) + d.name + '…');
        call(channel, d.mac).then(function (r) {
            btBusy = false;
            return btRefresh(false).then(function () {
                if (!r.ok) setNote('btNote', "Couldn't do that with " + d.name + (r.error ? ' (' + r.error.split('\n').pop() + ')' : '.'));
            });
        });
    }

    function btRender(devices) {
        var list = el('btList');
        list.textContent = '';
        if (!devices.length) { setNote('btNote', 'No devices found. Put your device in pairing mode and press Search.'); return; }
        devices.forEach(function (d) {
            var extra = null;
            if (d.paired) {
                extra = document.createElement('span');
                extra.className = 'set-item-x';
                extra.textContent = '×';
                extra.title = 'Forget this device';
                extra.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    sfx('button-cancel.mp3');
                    call('sys-bt-remove', d.mac).then(function () { btRefresh(false); });
                });
            }
            list.appendChild(row(d.name, d.connected ? 'Connected' : (d.paired ? 'Paired' : 'Not paired'), function () { btAction(d); }, extra));
        });
    }

    function btRefresh(scan) {
        setNote('btNote', scan ? 'Searching…' : '');
        if (scan) el('btList').textContent = '';
        return call('sys-bt-list', !!scan).then(function (r) {
            if (!r.ok) { setNote('btNote', r.error || "Couldn't list devices."); return; }
            setNote('btNote', '');
            btRender(r.devices);
        });
    }

    function btPaint() {
        el('btState').textContent = btOn ? 'Bluetooth is on' : 'Bluetooth is off';
        el('btToggle').textContent = btOn ? 'Turn off' : 'Turn on';
        el('btScan').style.display = btOn ? '' : 'none';
        if (!btOn) { el('btList').textContent = ''; setNote('btNote', ''); }
    }

    function initBluetooth() {
        el('btToggle').style.display = el('btScan').style.display = '';
        el('btList').textContent = '';
        setNote('btNote', '');
        call('sys-bt-status').then(function (r) {
            if (!r.ok) {
                el('btState').textContent = 'Bluetooth';
                el('btToggle').style.display = el('btScan').style.display = 'none';
                setNote('btNote', r.code === 'missing' ? "Bluetooth isn't available (bluetoothctl not found)." :
                    (r.code === 'none' ? 'No Bluetooth adapter found.' : "Bluetooth isn't available."));
                return;
            }
            btOn = r.enabled;
            btPaint();
            if (btOn) btRefresh(false);
        });
        if (btReady) return;
        btReady = true;
        el('btToggle').addEventListener('click', function () {
            sfx('button-select.mp3');
            call('sys-bt-enable', !btOn).then(function (r) {
                if (!r.ok) { setNote('btNote', r.error || "Couldn't switch Bluetooth."); return; }
                btOn = !btOn;
                btPaint();
                if (btOn) btRefresh(false);
            });
        });
        el('btScan').addEventListener('click', function () { sfx('button-select.mp3'); btRefresh(true); });
    }
})();
