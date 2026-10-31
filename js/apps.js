// Automatically creates a channel for every installed desktop application,
// like a start menu would list them. Channels can still be edited or deleted
// in the channel manager; deleted ones are remembered and not created again.

var DISMISSED_APPS_KEY = 'wiidesk-dismissed-apps';
var APP_CHANNEL_PREFIX = 'app-';


function getDismissedApps() {
    return WiiDeskStorage.load(DISMISSED_APPS_KEY, []);
}

function dismissApp(channelId) {
    var list = getDismissedApps();
    if (list.indexOf(channelId) === -1) {
        list.push(channelId);
        WiiDeskStorage.save(DISMISSED_APPS_KEY, list);
    }
}

function clearDismissedApps() {
    WiiDeskStorage.save(DISMISSED_APPS_KEY, []);
}

// Resolves once userChannels is up to date. Never rejects.
function syncInstalledApps() {
    if (!window.electronIpc) return Promise.resolve(false);

    // Apps that already have a channel (or were deleted) don't need their icon looked up again
    var skipIcons = userChannels
        .filter(function (c) { return c.autoApp; })
        .map(function (c) { return c.id.slice(APP_CHANNEL_PREFIX.length); })
        .concat(getDismissedApps().map(function (id) { return id.slice(APP_CHANNEL_PREFIX.length); }));

    return window.electronIpc.invoke('list-apps', skipIcons).then(function (apps) {
        var changed = false;
        var installed = {};
        apps.forEach(function (a) { installed[APP_CHANNEL_PREFIX + a.id] = a; });

        // The Disc Channel used to point at a Windows path
        userChannels.forEach(function (c) {
            if (c.id === 'disc' && /^[A-Za-z]:\\/.test(c.target || '')) {
                c.target = 'xdg-open "$HOME"';
                changed = true;
            }
        });

        // Drop channels of uninstalled apps
        var channels = userChannels.filter(function (c) { return !c.autoApp || installed[c.id]; });
        if (channels.length !== userChannels.length) changed = true;

        // Add channels for new apps
        var have = {};
        channels.forEach(function (c) { have[c.id] = true; });
        var dismissed = getDismissedApps();

        apps.forEach(function (a) {
            var id = APP_CHANNEL_PREFIX + a.id;
            if (have[id] || dismissed.indexOf(id) !== -1) return;
            channels.push({
                id: id,
                title: a.name,
                assets: 'assets/channels/',
                channelart: 'channelart/',
                customArt: { icon: a.icon, previewImage: null, previewMusic: null },
                target: a.file,
                isAppLauncher: true,
                autoApp: true
            });
            changed = true;
        });

        if (changed) {
            userChannels = channels;
            WiiDeskStorage.save('wiidesk-channels', userChannels);
        }
        return changed;
    }).catch(function (err) {
        console.error('syncInstalledApps failed:', err);
        return false;
    });
}
