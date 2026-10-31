// Finds installed desktop applications the same way a start menu does:
// scans the XDG "applications" directories for .desktop files and filters out hidden entries.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

// Name this desktop environment uses in OnlyShowIn / NotShowIn
const DESKTOP_NAME = 'WiiDesk';

const ICON_SIZES = ['scalable', '512x512', '256x256', '192x192', '128x128', '96x96', '64x64', '48x48'];
const ICON_EXTS = ['svg', 'png'];

function dataDirs() {
    const home = os.homedir();
    const dirs = [process.env.XDG_DATA_HOME || path.join(home, '.local', 'share')];
    dirs.push(...(process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean));
    // Flatpak and Snap export their launchers here
    dirs.push(
        '/var/lib/flatpak/exports/share',
        path.join(home, '.local', 'share', 'flatpak', 'exports', 'share'),
        '/var/lib/snapd/desktop'
    );
    return [...new Set(dirs)];
}

function collectDesktopFiles(appDir, sub, out) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(appDir, sub), { withFileTypes: true });
    } catch (e) {
        return;
    }
    for (const e of entries) {
        const rel = sub ? path.join(sub, e.name) : e.name;
        if (e.isDirectory()) {
            collectDesktopFiles(appDir, rel, out);
        } else if (e.name.endsWith('.desktop')) {
            // Desktop file ID: path relative to "applications" with "/" replaced by "-"
            out.push({ id: rel.split(path.sep).join('-'), file: path.join(appDir, rel) });
        }
    }
}

function parseDesktopFile(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    const entry = {};
    let inEntry = false;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line || line[0] === '#') continue;
        if (line[0] === '[') {
            inEntry = line === '[Desktop Entry]';
            continue;
        }
        if (!inEntry) continue;
        const i = line.indexOf('=');
        if (i < 1) continue;
        entry[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return entry;
}

function localizedName(entry) {
    const lang = (process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '').split('.')[0];
    const short = lang.split('_')[0];
    return entry['Name[' + lang + ']'] || entry['Name[' + short + ']'] || entry.Name;
}

function splitList(value) {
    return (value || '').split(';').filter(Boolean);
}

function commandExists(cmd) {
    const check = (p) => {
        try { fs.accessSync(p, fs.constants.X_OK); return true; } catch (e) { return false; }
    };
    if (path.isAbsolute(cmd)) return check(cmd);
    return (process.env.PATH || '').split(':').some((dir) => dir && check(path.join(dir, cmd)));
}

// Same rules a start menu applies
function isShown(entry) {
    if (entry.Type !== 'Application' || !entry.Name) return false;
    if (entry.NoDisplay === 'true' || entry.Hidden === 'true') return false;
    const only = splitList(entry.OnlyShowIn);
    if (only.length && !only.includes(DESKTOP_NAME)) return false;
    if (splitList(entry.NotShowIn).includes(DESKTOP_NAME)) return false;
    if (entry.TryExec && !commandExists(entry.TryExec)) return false;
    return true;
}

function iconSearchPaths() {
    const home = os.homedir();
    const bases = [path.join(home, '.local', 'share', 'icons'), path.join(home, '.icons')];
    for (const d of dataDirs()) bases.push(path.join(d, 'icons'));
    return [...new Set(bases)].filter((b) => fs.existsSync(b));
}

function createIconFinder() {
    const bases = iconSearchPaths();
    const themes = ['hicolor'];
    for (const b of bases) {
        try {
            for (const t of fs.readdirSync(b)) if (!themes.includes(t)) themes.push(t);
        } catch (e) { /* ignore unreadable dirs */ }
    }

    return function findIcon(name) {
        if (!name) return null;
        if (path.isAbsolute(name)) {
            return fs.existsSync(name) && !name.endsWith('.xpm') ? name : null;
        }
        for (const theme of themes) {
            for (const base of bases) {
                for (const size of ICON_SIZES) {
                    for (const ext of ICON_EXTS) {
                        const p = path.join(base, theme, size, 'apps', name + '.' + ext);
                        if (fs.existsSync(p)) return p;
                    }
                }
            }
        }
        for (const ext of ICON_EXTS) {
            const p = path.join('/usr/share/pixmaps', name + '.' + ext);
            if (fs.existsSync(p)) return p;
        }
        return null;
    };
}

// Returns [{ id, file, name, icon }] for every app a start menu would show.
// Icons (as file:// URLs) are only resolved for apps whose id is not in skipIconIds.
function listApps(skipIconIds) {
    const skip = new Set(skipIconIds || []);
    const findIcon = createIconFinder();
    const seen = new Set();
    const apps = [];

    for (const dir of dataDirs()) {
        const files = [];
        collectDesktopFiles(path.join(dir, 'applications'), '', files);
        for (const { id, file } of files) {
            // The first directory wins, even if it hides the app (XDG override rules)
            if (seen.has(id)) continue;
            seen.add(id);

            const entry = parseDesktopFile(file);
            if (!entry || !isShown(entry)) continue;

            let icon = null;
            if (!skip.has(id)) {
                const iconPath = findIcon(entry.Icon);
                if (iconPath) icon = pathToFileURL(iconPath).href;
            }
            apps.push({ id, file, name: localizedName(entry), icon });
        }
    }

    apps.sort((a, b) => a.name.localeCompare(b.name));
    return apps;
}

module.exports = { listApps };
