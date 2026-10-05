
var WiiDeskStorage = (function() {
    var fs = null;
    var path = null;
    var dir = null;
    var useFs = false;

    try {
        fs = require('fs');
        path = require('path');
        var os = require('os');

        var base;
        if (process.platform === 'win32') {
            base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        } else if (process.platform === 'darwin') {
            base = path.join(os.homedir(), 'Library', 'Application Support');
        } else {
            base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
        }
        dir = path.join(base, 'WiiDesk');

        fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        useFs = true;
    } catch (e) {
        useFs = false;
    }

    function filePaths(key) {
        return {
            main: path.join(dir, key + '.json'),
            backup: path.join(dir, key + '.backup.json'),
            tmp: path.join(dir, key + '.tmp.json')
        };
    }

    function readJsonFile(filePath) {
        var raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    }

    function loadFs(key, fallback) {
        var p = filePaths(key);

        if (fs.existsSync(p.main)) {
            try {
                return readJsonFile(p.main);
            } catch (e) {
                console.error('WiiDeskStorage: "' + key + '" main file is corrupted, trying backup.', e);
            }
        }

        if (fs.existsSync(p.backup)) {
            try {
                var recovered = readJsonFile(p.backup);
                console.warn('WiiDeskStorage: recovered "' + key + '" from backup.');
                try { fs.copyFileSync(p.backup, p.main); } catch (e2) {}
                return recovered;
            } catch (e) {
                console.error('WiiDeskStorage: "' + key + '" backup is ALSO corrupted.', e);
            }
        }

        try {
            var legacy = localStorage.getItem(key);
            if (legacy) {
                var parsedLegacy = JSON.parse(legacy);
                console.warn('WiiDeskStorage: migrating "' + key + '" from localStorage to disk.');
                saveFs(key, parsedLegacy);
                return parsedLegacy;
            }
        } catch (e) {}

        return fallback;
    }

    function saveFs(key, data) {
        var p = filePaths(key);
        var json = JSON.stringify(data);
        try {
            fs.writeFileSync(p.tmp, json, 'utf-8');
            fs.renameSync(p.tmp, p.main);
            fs.writeFileSync(p.backup, json, 'utf-8');
            return true;
        } catch (e) {
            console.error('WiiDeskStorage: failed to save "' + key + '" to disk.', e);
            return false;
        }
    }

    function loadLocalStorage(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error('WiiDeskStorage: "' + key + '" in localStorage is corrupted, trying backup.', e);
        }
        try {
            var backupRaw = localStorage.getItem(key + '__backup');
            if (backupRaw) {
                var recovered = JSON.parse(backupRaw);
                console.warn('WiiDeskStorage: recovered "' + key + '" from localStorage backup.');
                localStorage.setItem(key, backupRaw);
                return recovered;
            }
        } catch (e) {
            console.error('WiiDeskStorage: "' + key + '" localStorage backup is ALSO corrupted.', e);
        }
        return fallback;
    }

    function saveLocalStorage(key, data) {
        try {
            var json = JSON.stringify(data);
            localStorage.setItem(key, json);
            localStorage.setItem(key + '__backup', json);
            return true;
        } catch (e) {
            console.error('WiiDeskStorage: failed to save "' + key + '" to localStorage.', e);
            return false;
        }
    }

    return {
        load: function(key, fallback) {
            return useFs ? loadFs(key, fallback) : loadLocalStorage(key, fallback);
        },
        save: function(key, data) {
            return useFs ? saveFs(key, data) : saveLocalStorage(key, data);
        },
        usingFileSystem: function() {
            return useFs;
        }
    };
})();
